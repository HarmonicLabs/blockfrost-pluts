import { CostModelPlutusV1, CostModelPlutusV2, CostModels, defaultV1Costs, defaultV2Costs, isCostModelsV1, isCostModelsV2, toCostModelV1, toCostModelV2 } from "@harmoniclabs/cardano-ledger-ts";
import { hasOwn, isObject } from "@harmoniclabs/obj-utils";

export function mockCostModels( blockfrostCostModels?: { [key: string]: unknown; } | null ): CostModels
{
    if( !isObject( blockfrostCostModels ) ) return {};

    const res: CostModels = {};

    if( hasOwn( blockfrostCostModels, "PlutusV1" ) )
    {
        res.PlutusScriptV1 = blockfrostCostModels.PlutusV1 = mockV1CostModel( blockfrostCostModels.PlutusV1 )
    }

    if( hasOwn( blockfrostCostModels, "PlutusV2" ) )
    {
        res.PlutusScriptV2 = blockfrostCostModels.PlutusV2 = mockV2CostModel( blockfrostCostModels.PlutusV2 )
    }

    return res;
}

export function mockV1CostModel( stuff: any ): CostModelPlutusV1
{
    if( Array.isArray( stuff ) )
    {
        const len = stuff.length ;
        for( let i = 0; i < len; i++ )
        {
            stuff[i] = BigInt( stuff[i] )
        }

        if( !isCostModelsV1( stuff ) ) return defaultV1Costs;

        return toCostModelV1( stuff );
    }

    if(!( typeof stuff === "object" && stuff !== null )) return defaultV1Costs;

    const keys = Object.keys( stuff );
    for(const k of keys)
    {
        stuff[k] = BigInt( stuff[k] )
    }

    return {
        ...defaultV1Costs,
        ...stuff
    };
}

export function mockV2CostModel( stuff: any ): CostModelPlutusV2
{
    if( Array.isArray( stuff ) )
    {
        const len = stuff.length ;
        for( let i = 0; i < len; i++ )
        {
            stuff[i] = BigInt( stuff[i] )
        }

        if( !isCostModelsV2( stuff ) ) return defaultV2Costs;

        return toCostModelV2( stuff );
    }

    if(!( typeof stuff === "object" && stuff !== null )) return defaultV2Costs;

    const keys = Object.keys( stuff );
    for(const k of keys)
    {
        stuff[k] = BigInt( stuff[k] )
    }
    
    return {
        ...defaultV2Costs,
        ...stuff
    };
}