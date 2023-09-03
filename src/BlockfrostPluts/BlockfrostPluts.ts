import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import type { CanBeData, GenesisInfos, ISubmitTx, ITxRunnerProvider, IGetProtocolParameters } from "@harmoniclabs/plu-ts-offchain";
import { UTxO, Hash32, Address, TxOutRef, Value, Script, ProtocolParamters, ITxOutRef, IUTxO, TxOutRefStr, isITxOutRef, isIUTxO, StakeAddress, StakeAddressBech32, StakeCredentials, AddressStr, Hash28, Tx } from "@harmoniclabs/cardano-ledger-ts";

import { BlockfrostOptions } from "./BlockfrostOptions";
import { Data, dataFromCbor } from "@harmoniclabs/plutus-data";
import { Cbor, CborBytes, CborPositiveRational } from "@harmoniclabs/cbor";
import { fromHex, toHex } from "@harmoniclabs/uint8array-utils";
import { blake2b_224 } from "@harmoniclabs/crypto";
import { mockCostModels } from "./mockCostModel";
import { ExBudget } from "@harmoniclabs/plutus-machine";
import { adaptProtocolParams } from "./utils/adaptProtocolParams";
import { AddressInfos } from "./types/AddressInfos";

type CanResolveToUTxO = IUTxO | ITxOutRef | TxOutRefStr;

function forceTxOutRefStr( canResolve: CanResolveToUTxO ): TxOutRefStr
{
    if( typeof canResolve === "string" ) return canResolve;
    
    if( isIUTxO( canResolve ) ) canResolve = canResolve.utxoRef;

    if( canResolve instanceof TxOutRef ) return canResolve.toString();
    if( isITxOutRef( canResolve ) ) return `${canResolve.id.toString()}#${canResolve.index}`;

    console.error( canResolve );
    throw new Error('"forceTxOutRefStr" expects a "CanResolveToUTxO"');
}

export type PaginationOptions = {
    count?: number;
    page?: number;
    order?: 'asc' | 'desc';
};

export type UTxOWithRefScriptHash = UTxO & { readonly refScriptHash?: Hash28 }

export class BlockfrostPluts
    implements ITxRunnerProvider, ISubmitTx, IGetProtocolParameters
{
    readonly api!: BlockFrostAPI;

    constructor( options: BlockfrostOptions | BlockFrostAPI )
    {
        Object.defineProperty(
            this, "api", {
                value: options instanceof BlockFrostAPI ? options : new BlockFrostAPI( options ),
                writable: false,
                enumerable: true,
                configurable: false 
            }
        );
    }

    /** @since 0.1.1 */
    submitTx( tx: string | Tx ): Promise<string>
    {
        tx = typeof tx === "string" ? tx : tx.toCbor().toString(); 
        return this.api.txSubmit( tx );
    };
    
    /** @since 0.1.3 */
    async getGenesisInfos(): Promise<GenesisInfos>
    {
        const gensis = await this.api.genesis();
        return {
            slotLengthInMilliseconds: gensis.slot_length * 1000,
            systemStartPOSIX: gensis.system_start * 1000
        };
    }

    /** @since 0.1.1 */
    async epochsParameters( epoch_no: number ): Promise<ProtocolParamters>
    {
        return adaptProtocolParams( await this.api.epochsParameters( epoch_no ) )
    }

    /** @since 0.1.1 */
    epochsLatestParameters(): Promise<ProtocolParamters>
    {
        return this.getProtocolParameters();
    }

    /** @since 0.1.0 */
    async getProtocolParameters(): Promise<ProtocolParamters>
    {
        return adaptProtocolParams( await this.api.epochsLatestParameters() )
    }
    
    /** @since 0.1.0 */
    async resolveUtxos(utxos: CanResolveToUTxO[]): Promise<UTxO[]>
    {
        const refs = utxos.map( u => {
            const [ id, idx ] = forceTxOutRefStr( u ).split("#");

            return new TxOutRef({
                id,
                index: parseInt( idx )
            });
        });

        const txHashes = refs.map( ref => ref.id.toString() )
        // filter out replicates
        .filter( (h, i, thisArr) => thisArr.indexOf( h ) === i );

        const txns = await Promise.all( txHashes.map( h => this.api.txsUtxos( h ) ) );

        return await Promise.all(
            refs.map(async ref => {

                const tx = txns.find( tx => tx.hash === ref.id.toString() );

                if( !tx ) throw new Error("unresolved utxo: " + ref.toString() );

                const resolved = tx.outputs.find( out => out.output_index === ref.index );

                if( !resolved ) throw new Error("unresolved utxo: " + ref.toString() );

                let refScript: Script | undefined =
                resolved.reference_script_hash ?
                await this.resolveScriptHash( resolved.reference_script_hash ) :
                undefined;
                
                return new UTxO({
                    utxoRef: ref,
                    resolved: {
                        address: Address.fromString( resolved.address ),
                        value: Value.fromUnits( resolved.amount ),
                        datum: resolved.inline_datum ? dataFromCbor( resolved.inline_datum ) :
                        resolved.data_hash ? new Hash32( resolved.data_hash ) :
                        undefined,
                        refScript
                    }
                })
            })
        );
    }

    /** @since 0.1.0 */
    resolveDatumHashes( hashes: Hash32[] ): Promise<{ hash: string; datum: CanBeData; }[]>
    {
        return Promise.all(
            hashes.map( async h => {
                const hStr = h.toString();
                return {
                    hash: hStr,
                    datum: (await this.api.scriptsDatumCbor( hStr )).cbor
                };
            })
        );
    }

    /** @since 0.1.1 */
    addressesInfos( address: AddressStr | Address ): Promise<AddressInfos>
    {
        return this.addressInfos( address );
    }

    /** @since 0.1.1 */
    async addressInfos( address: AddressStr | Address ): Promise<AddressInfos>
    {
        const response = await this.api.addresses( address.toString() );
        const result = {} as AddressInfos;
        
        result.address = Address.fromString( response.address );
        result.totAmount = Value.fromUnits( response.amount );
        result.stakeAddress = response.stake_address ?
            StakeAddress.fromString( response.stake_address ) :
            undefined;
        result.type = response.type;
        result.script = response.script;

        return result;
    }

    /** @since 0.1.1 */
    async addressTotalAmount( address: AddressStr | Address ): Promise<Value>
    {
        return (await this.addressInfos(address)).totAmount;
    }

    /** @since 0.1.0 */
    addressesUtxos( address: AddressStr | Address, pagination?: PaginationOptions ): Promise<UTxOWithRefScriptHash[]>
    {
        return this.addressUtxos( address, pagination );
    }

    /** @since 0.1.0 */
    async addressUtxos( address: AddressStr | Address, pagination?: PaginationOptions ): Promise<UTxOWithRefScriptHash[]>
    {
        address = address.toString() as AddressStr;
        const _utxos = await this.api.addressesUtxos( address, pagination );

        return _utxos.map(({
            address,
            tx_hash,
            output_index,
            amount,
            // block,
            data_hash,
            inline_datum,
            reference_script_hash,
        }) => {

            const datum: Hash32 | Data | undefined = 
                inline_datum ? dataFromCbor( inline_datum ) :
                data_hash ? new Hash32( data_hash ) :
                undefined;

            const utxo = new UTxO({
                utxoRef: {
                    id: tx_hash,
                    index: output_index
                },
                resolved: {
                    address: Address.fromString( address ),
                    value: Value.fromUnits( amount ),
                    datum,
                    refScript: undefined
                }
            });

            if( reference_script_hash )
            {
                Object.defineProperty(
                    utxo, "refScriptHash", {
                        value: new Hash28( reference_script_hash ),
                        writable: false,
                        enumerable: true,
                        configurable: false,
                    }
                )
            };

            return utxo;
        })
    };

    /** @since 0.1.0 */
    scriptsCbor( hash: string | Hash28 ): Promise<Script>
    {
        return this.resolveScriptHash( hash );
    }

    /** @since 0.1.2 */
    async resolveScriptHash( hash: string | Hash28 ): Promise<Script>
    {
        hash = hash.toString();
        const res = await this.api.scriptsCbor( hash );

        let script: Script | undefined;

        if( !res.cbor )
        {
            throw new Error(
                `unresolved reference script with hash "${hash}"`
            );
        }
        const cbor = Cbor.parse( res.cbor );
        const cborBytes = fromHex( res.cbor );

        if( cbor instanceof CborBytes )
        {
            const scriptCbor = cbor.buffer;

            const v1Hash = toHex(
                blake2b_224(
                    new Uint8Array(
                        [
                            0x01,
                            ...cborBytes
                        ]
                    )
                )
            );

            if( v1Hash === hash )
            {
                script = new Script(
                    "PlutusScriptV1",
                    scriptCbor
                )
            }
            else
            {
                script = new Script(
                    "PlutusScriptV2",
                    scriptCbor
                )
            }
        }
        else
        {
            script = new Script(
                "NativeScript",
                cborBytes
            );
        }

        return script;
    }
}