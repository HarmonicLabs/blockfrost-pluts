import { Tx, TxRedeemer, TxRedeemerTag } from "@harmoniclabs/buildooor";
import { isObject } from "@harmoniclabs/obj-utils";

function isOgmios5EvalTxResponse( stuff: any ): boolean
{
    return isObject( stuff ) && (
        stuff.type === "jsonwsp/response" &&
        stuff.version === "1.0" &&
        stuff.servicename === "ogmios"
    );
}

type OgmiosTag = "spend" | "mint" | "certificate" | "withdrawal";

export interface OgmiosRdmrExUnits {
    tag: TxRedeemerTag,
    index: number,
    exunits: {
        mem: bigint,
        cpu: bigint
    }
}

function adaptOgmiosTag( tag: OgmiosTag ): TxRedeemerTag
{
    switch(tag)
    {
        case "spend": return TxRedeemerTag.Spend;
        case "mint": return TxRedeemerTag.Mint;
        case "certificate": return TxRedeemerTag.Cert;
        case "withdrawal": return TxRedeemerTag.Withdraw;
    }
}

function ogmiosEvalTxResultToPartialTxRdmrs( result: any ): OgmiosRdmrExUnits[]
{
    if( typeof result !== "object" || result === null ) throw new Error("invalid ogmios result")

    const keys = Object.keys( result );
    const rdmrs: OgmiosRdmrExUnits[] = [];
    
    for( const k of keys )
    {
        const [ tagStr, idxStr ] = k.split(":");
        rdmrs.push({
            tag: adaptOgmiosTag( tagStr as any ),
            index: parseInt( idxStr ),
            exunits: {
                mem: result[k].memory,
                cpu: result[k].steps
            }
        });
    }

    return rdmrs;
}

export function getRealTxRedeemers( tx: Tx, response: any ): OgmiosRdmrExUnits[]
{
    // if( !isOgmios5EvalTxResponse( response ) ) throw new Error("unexpected response; expected ogmios 5.6 EvalTx response");
    if( !response.result ) throw new Error( "Missing Ogmios result: " + (response.fault?.string ?? ""));

    return ogmiosEvalTxResultToPartialTxRdmrs(
        response.result?.EvaluationResult ?? response.result
    );
}