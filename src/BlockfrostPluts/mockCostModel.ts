import { CostModelPlutusV1, CostModelPlutusV2, CostModelPlutusV3, CostModels, defaultV1Costs, defaultV2Costs, defaultV3Costs, isCostModelsV1, isCostModelsV2, isCostModelsV3, toCostModelV1, toCostModelV2, toCostModelV3 } from "@harmoniclabs/cardano-costmodels-ts";
import { hasOwn, isObject } from "@harmoniclabs/obj-utils";

export function mockCostModels( 
    blockfrostCostModels?: { [key: string]: unknown; } | null,
    raw?: { [key: string]: number[]; } | null
): CostModels
{
    if( !isObject( blockfrostCostModels ) ) return {};

    const res: CostModels = {
        PlutusScriptV1: defaultV1Costs,
        PlutusScriptV2: defaultV2Costs,
        PlutusScriptV3: defaultV3Costs
    };

    if( hasOwn( blockfrostCostModels, "PlutusV1" ) )
    {
        if( raw && isCostModelsV1( raw.PlutusV1 ) ) res.PlutusScriptV1 = toCostModelV1( raw.PlutusV1 );
        else res.PlutusScriptV1 = blockfrostCostModels.PlutusV1 = mockV1CostModel( blockfrostCostModels.PlutusV1 )
    }

    if( hasOwn( blockfrostCostModels, "PlutusV2" ) )
    {
        if( raw && isCostModelsV2( raw.PlutusV2 ) ) res.PlutusScriptV2 = toCostModelV2( raw.PlutusV2 );
        else res.PlutusScriptV2 = blockfrostCostModels.PlutusV2 = mockV2CostModel( blockfrostCostModels.PlutusV2 )
    }

    if( hasOwn( blockfrostCostModels, "PlutusV3" ) )
    {
        if( raw && isCostModelsV3( raw.PlutusV3 ) ) res.PlutusScriptV3 = toCostModelV3( raw.PlutusV3 );
        else res.PlutusScriptV3 = blockfrostCostModels.PlutusV3 = mockV3CostModel( blockfrostCostModels.PlutusV3 )
    }

    return res;
}

/**
 * on sanchonet sometimes we get an array like without length property
 * 
 * if that is the case we normalize,
 * otherwise we return whatever was sent
 * 
 */
function normalizeArrayLike( obj: any ): any
{
    if( !isObject( obj ) ) return obj;

    let keys = Object.keys( obj );
    if( keys.includes("length") )
    {
        return Array.from( obj );
    }

    const nums = keys.map( k => Number( k ) );
    // if not array like, return as is
    if( !nums.every( n => Number.isSafeInteger( n ) && n >= 0 ) ) return obj;

    const length = Math.max( ...nums ) + 1;
    const array = new Array( length );
    for( const n of nums )
    {
        array[n] = obj[n];
    }

    return array;
}

export function mockV1CostModel( stuff: any ): CostModelPlutusV1
{
    stuff = normalizeArrayLike( stuff );
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
    stuff = normalizeArrayLike( stuff );
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

export function mockV3CostModel( stuff: any ): CostModelPlutusV3
{
    stuff = normalizeArrayLike( stuff );
    if( Array.isArray( stuff ) )
    {
        const len = stuff.length ;
        for( let i = 0; i < len; i++ )
        {
            stuff[i] = BigInt( stuff[i] )
        }

        if( !isCostModelsV3( stuff ) ) return defaultV3Costs;

        return toCostModelV3( stuff );
    }

    if(!( typeof stuff === "object" && stuff !== null )) return defaultV3Costs;

    const keys = Object.keys( stuff );
    for(const k of keys)
    {
        stuff[k] = BigInt( stuff[k] )
    }
    
    return {
        ...defaultV3Costs,
        ...stuff
    };
}