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

export function paginationOptsToStr({ count, page, order }: PaginationOptions ): string
{
    let str = "";
    let hasAny = false;
    if( typeof count === "number" )
    {
        str += "?count=" + count.toString();
        hasAny = true;
    }
    if( typeof page === "number" )
    {
        str += hasAny ? "&" : "?";
        str += "page="+page.toString();
        hasAny = true;
    }
    if( order === "asc" || order === "desc" )
    {
        str += hasAny ? "&" : "?";
        str += "order="+order;
    }
    return str;
}

export type UTxOWithRefScriptHash = UTxO & { readonly refScriptHash?: Hash28 }

export class BlockfrostPluts
    implements ITxRunnerProvider, ISubmitTx, IGetProtocolParameters
{
    readonly network: "mainnet" | "preview" | "preprod";
    readonly url: string;
    readonly projectId: string;

    constructor({ projectId, customBackend }: BlockfrostOptions )
    {
        if( typeof projectId !== "string" ) throw new Error("blockfrost projectId not a string");
        const network = (
            projectId.startsWith("mainnet") ? "mainnet" :
            projectId.startsWith("preprod") ? "preprod" :
            projectId.startsWith("preview") ? "preview" : ""
        );
        if( network === "" ) throw new Error("invalid projectId");

        const url = customBackend ?? (
            network === "mainnet" ? "https://cardano-mainnet.blockfrost.io/api/v0": 
            network === "preprod" ? "https://cardano-preprod.blockfrost.io/api/v0": 
            network === "preview" ? "https://cardano-preview.blockfrost.io/api/v0": ""
        );

        Object.defineProperties(
            this, {
                network : {
                    value: network,
                    writable: false,
                    enumerable: true,
                    configurable: false,
                },
                url: {
                    value: url,
                    writable: false,
                    enumerable: true,
                    configurable: false,
                },
                projectId: {
                    value: projectId,
                    writable: false,
                    enumerable: true,
                    configurable: false,
                }
            }
        );
    }

    /** @since 0.1.4 */
    async submitTx( tx: string | Tx ): Promise<string>
    {
        tx = typeof tx === "string" ? Tx.fromCbor( tx ) : tx; 
        const res = await fetch(`${this.url}/tx/submit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/cbor",
                "project_id": this.projectId
            },
            body: tx.toCbor().toBuffer().buffer
        });
        if (!res.ok) throw res.statusText + await res.text();
        return (tx as Tx).hash.toString();
    };

    async get( url: string )
    {
        const res = await fetch(url, {
            headers: {
                "project_id": this.projectId
            }
        });
        if (!res.ok) throw res.statusText + await res.text();
        return await res.json();
    }
    
    /** @since 0.1.3 */
    async getGenesisInfos(): Promise<GenesisInfos>
    {
        const genesis = await this.get(`${this.url}/genesis`);
        return {
            slotLengthInMilliseconds: Number( genesis.slot_length ) * 1000,
            systemStartPOSIX: Number( genesis.system_start ) * 1000
        };
    }

    /** @since 0.1.1 */
    async epochsParameters( epoch_no: number ): Promise<ProtocolParamters>
    {
        return adaptProtocolParams( await this.get(`${this.url}/epochs/${epoch_no}/parameters`) )
    }

    /** @since 0.1.1 */
    epochsLatestParameters(): Promise<ProtocolParamters>
    {
        return this.getProtocolParameters();
    }

    /** @since 0.1.0 */
    async getProtocolParameters(): Promise<ProtocolParamters>
    {
        return adaptProtocolParams( await this.get(`${this.url}/epochs/latest/parameters`) )
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

        const txns = await Promise.all(
            txHashes.map( h =>
                this.get(`${this.url}/txs/${h}/utxos`)
            )
        );

        return await Promise.all(
            refs.map(async ref => {

                const tx = txns.find( tx => tx.hash === ref.id.toString() );

                if( !tx ) throw new Error("unresolved utxo: " + ref.toString() );

                const resolved = tx.outputs.find( (out: any) => out.output_index === ref.index );

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
                    datum: (await this.get(`${this.url}/scripts/datum/${hStr}`)).cbor
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
        const response = await this.get(`${this.url}/addresses/${address.toString()}`);
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
        let url
        const _utxos = await this.get(`${this.url}/addresses/${address}/utxos${paginationOptsToStr( pagination ?? {} )}`);

        return _utxos.map(({
            address,
            tx_hash,
            output_index,
            amount,
            // block,
            data_hash,
            inline_datum,
            reference_script_hash,
        }: any) => {

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
        const res = await this.get(`${this.url}/scripts/${hash}/cbor`);

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