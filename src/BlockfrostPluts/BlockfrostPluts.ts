import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import type { CanBeData, GenesisInfos, ISubmitTx, ITxRunnerProvider, IGetProtocolParameters } from "@harmoniclabs/plu-ts-offchain";
import { UTxO, Hash32, Address, TxOutRef, Value, Script, ProtocolParamters, ITxOutRef, IUTxO, TxOutRefStr, isITxOutRef, isIUTxO, StakeAddress, StakeAddressBech32, StakeCredentials, AddressStr } from "@harmoniclabs/cardano-ledger-ts";

import { BlockfrostOptions } from "./BlockfrostOptions";
import { dataFromCbor } from "@harmoniclabs/plutus-data";
import { Cbor, CborBytes, CborPositiveRational } from "@harmoniclabs/cbor";
import { fromHex, toHex } from "@harmoniclabs/uint8array-utils";
import { blake2b_224 } from "@harmoniclabs/crypto";
import { mockCostModels } from "./mockCostModel";
import { ExBudget } from "@harmoniclabs/plutus-machine";

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

    /** @since 0.1.0 */
    submitTx = this.api.txSubmit;
    
    /** @since 0.1.0 */
    async getGenesisInfos(): Promise<GenesisInfos>
    {
        const gensis = await this.api.genesis();
        return {
            slotLengthInMilliseconds: gensis.slot_length * 1000,
            systemStartPOSIX: gensis.system_start
        };
    }

    /** @since 0.1.0 */
    async getProtocolParameters(): Promise<ProtocolParamters>
    {
        const pp = await this.api.epochsLatestParameters();

        return {
            collateralPercentage: pp.collateral_percent ?? 150,
            costModels: mockCostModels( pp.cost_models ),
            executionUnitPrices: {
                priceMemory: pp.price_mem ?? 0.0577,
                priceSteps: pp.price_step ?? 0.0000721
            },
            maxBlockBodySize: pp.max_block_size,
            maxBlockExecutionUnits: new ExBudget({
                mem: BigInt( pp.max_block_ex_mem ?? 50000000 ),
                cpu: BigInt( pp.max_block_ex_steps ?? 40000000000 )
            }),
            maxBlockHeaderSize: pp.max_block_header_size,
            maxCollateralInputs: pp.max_collateral_inputs ?? 3,
            maxTxExecutionUnits: new ExBudget({
                mem: BigInt( pp.max_tx_ex_mem ?? 0 ),
                cpu: BigInt( pp.max_tx_ex_steps ?? 0 )
            }),
            maxTxSize: pp.max_tx_size,
            maxValueSize: BigInt( pp.max_val_size ?? 0 ),
            minPoolCost: BigInt( pp.min_pool_cost ),
            monetaryExpansion: CborPositiveRational.fromNumber( pp.rho ),
            treasuryCut: CborPositiveRational.fromNumber( pp.tau ),
            poolPledgeInfluence: CborPositiveRational.fromNumber( pp.a0 ),
            poolRetireMaxEpoch: pp.e_max,
            protocolVersion: {
                major: pp.protocol_major_ver,
                minor: pp.protocol_minor_ver
            },
            stakeAddressDeposit: BigInt( pp.key_deposit ),
            stakePoolDeposit: BigInt( pp.pool_deposit ),
            stakePoolTargetNum: BigInt( pp.n_opt ),
            txFeeFixed: BigInt( pp.min_fee_b ),
            txFeePerByte: BigInt( pp.min_fee_a ),
            utxoCostPerByte: BigInt( pp.coins_per_utxo_size ?? 34482 )
        }
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

                let refScript: Script | undefined = undefined;
                if( resolved.reference_script_hash )
                {
                    const res = await this.api.scriptsCbor( resolved.reference_script_hash );
                    if( !res.cbor )
                    {
                        throw new Error(
                            `unresolved reference script with hash "${resolved.reference_script_hash}" for utxo "${ref.toString()}"`
                        );
                    }
                    const cbor = Cbor.parse( res.cbor );

                    if( cbor instanceof CborBytes )
                    {
                        const scriptCbor = cbor.buffer;
                        const v1Hash = toHex(
                            blake2b_224(
                                new Uint8Array(
                                    [
                                        0x01,
                                        ...scriptCbor
                                    ]
                                )
                            )
                        );

                        if( v1Hash === resolved.reference_script_hash )
                        {
                            refScript = new Script(
                                "PlutusScriptV1",
                                (Cbor.parse(
                                    scriptCbor
                                ) as CborBytes).buffer
                            )
                        }
                        else
                        {
                            refScript = new Script(
                                "PlutusScriptV2",
                                (Cbor.parse(
                                    scriptCbor
                                ) as CborBytes).buffer
                            )
                        }
                    }
                    else
                    {
                        refScript = new Script(
                            "NativeScript",
                            fromHex( res.cbor )
                        );
                    }

                }
                
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
}