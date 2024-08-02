import { defaultProtocolParameters, ProtocolParameters } from "@harmoniclabs/cardano-ledger-ts";
import { CborPositiveRational } from "@harmoniclabs/cbor";
import { mockCostModels } from "../mockCostModel";

export type BlockfrostProtocolParams = {
    /**
     * @description Epoch number
     * @example 225
     */
    epoch: number;
    /**
     * @description The linear factor for the minimum fee calculation for given epoch
     * @example 44
     */
    min_fee_a: number;
    /**
     * @description The constant factor for the minimum fee calculation
     * @example 155381
     */
    min_fee_b: number;
    /**
     * @description Maximum block body size in Bytes
     * @example 65536
     */
    max_block_size: number;
    /**
     * @description Maximum transaction size
     * @example 16384
     */
    max_tx_size: number;
    /**
     * @description Maximum block header size
     * @example 1100
     */
    max_block_header_size: number;
    /**
     * @description The amount of a key registration deposit in Lovelaces
     * @example 2000000
     */
    key_deposit: string;
    /**
     * @description The amount of a pool registration deposit in Lovelaces
     * @example 500000000
     */
    pool_deposit: string;
    /**
     * @description Epoch bound on pool retirement
     * @example 18
     */
    e_max: number;
    /**
     * @description Desired number of pools
     * @example 150
     */
    n_opt: number;
    /**
     * @description Pool pledge influence
     * @example 0.3
     */
    a0: number;
    /**
     * @description Monetary expansion
     * @example 0.003
     */
    rho: number;
    /**
     * @description Treasury expansion
     * @example 0.2
     */
    tau: number;
    /**
     * @description Percentage of blocks produced by federated nodes
     * @example 0.5
     */
    decentralisation_param: number;
    /**
     * @description Seed for extra entropy
     * @example null
     */
    extra_entropy: string | null;
    /**
     * @description Accepted protocol major version
     * @example 2
     */
    protocol_major_ver: number;
    /**
     * @description Accepted protocol minor version
     * @example 0
     */
    protocol_minor_ver: number;
    /**
     * @description Minimum UTXO value
     * @example 1000000
     */
    min_utxo: string;
    /**
     * @description Minimum stake cost forced on the pool
     * @example 340000000
     */
    min_pool_cost: string;
    /**
     * @description Epoch number only used once
     * @example 1a3be38bcbb7911969283716ad7aa550250226b76a61fc51cc9a9a35d9276d81
     */
    nonce: string;
    /**
     * @description Cost models parameters for Plutus Core scripts
     * @example {
     *   "PlutusV1": {
     *     "addInteger-cpu-arguments-intercept": 197209,
     *     "addInteger-cpu-arguments-slope": 0
     *   },
     *   "PlutusV2": {
     *     "addInteger-cpu-arguments-intercept": 197209,
     *     "addInteger-cpu-arguments-slope": 0
     *   }
     * }
     */
    cost_models: 
        {
            [key: string]: unknown | undefined;
        } |
        null;
    /**
     * @description The per word cost of script memory usage
     * @example 0.0577
     */
    price_mem: number | null;
    /**
     * @description The cost of script execution step usage
     * @example 0.0000721
     */
    price_step: number | null;
    /**
     * @description The maximum number of execution memory allowed to be used in a single transaction
     * @example 10000000
     */
    max_tx_ex_mem: string | null;
    /**
     * @description The maximum number of execution steps allowed to be used in a single transaction
     * @example 10000000000
     */
    max_tx_ex_steps: string | null;
    /**
     * @description The maximum number of execution memory allowed to be used in a single block
     * @example 50000000
     */
    max_block_ex_mem: string | null;
    /**
     * @description The maximum number of execution steps allowed to be used in a single block
     * @example 40000000000
     */
    max_block_ex_steps: string | null;
    /**
     * @description The maximum Val size
     * @example 5000
     */
    max_val_size: string | null;
    /**
     * @description The percentage of the transactions fee which must be provided as collateral when including non-native scripts
     * @example 150
     */
    collateral_percent: number | null;
    /**
     * @description The maximum number of collateral inputs allowed in a transaction
     * @example 3
     */
    max_collateral_inputs: number | null;
    /**
     * @description Cost per UTxO word for Alonzo. Cost per UTxO byte for Babbage and later.
     * @example 34482
     */
    coins_per_utxo_size: string | null;
    /**
     * @deprecated
     * @description Cost per UTxO word for Alonzo. Cost per UTxO byte for Babbage and later.
     * @example 34482
     */
    coins_per_utxo_word: string | null;
}

export function adaptProtocolParams( pp: BlockfrostProtocolParams ): ProtocolParameters
{
    return {
        ...defaultProtocolParameters,
        ...(pp as any),
        collateralPercentage: pp.collateral_percent ?? 150,
        costModels: mockCostModels( pp.cost_models ),
        executionUnitPrices: {
            priceMemory: pp.price_mem ?? 0.0577,
            priceSteps: pp.price_step ?? 0.0000721
        },
        maxBlockBodySize: pp.max_block_size,
        maxBlockExecutionUnits: ({
            memory: Number( pp.max_block_ex_mem ?? 50000000 ),
            steps: Number( pp.max_block_ex_steps ?? 40000000000 ),
        }),
        maxBlockHeaderSize: pp.max_block_header_size,
        maxCollateralInputs: pp.max_collateral_inputs ?? 3,
        maxTxExecutionUnits: ({
            memory: Number( pp.max_tx_ex_mem ?? 0 ),
            steps: Number( pp.max_tx_ex_steps ?? 0 )
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
        utxoCostPerByte: BigInt( pp.coins_per_utxo_size ?? 34482 ),
    } as ProtocolParameters
}