import { Tx, TxRedeemer, TxRedeemerTag } from "@harmoniclabs/cardano-ledger-ts";
import { isObject } from "@harmoniclabs/obj-utils";
import { ExBudget } from "@harmoniclabs/plutus-machine";

function isOgmios5EvalTxResponse( stuff: any ): boolean
{
    return isObject( stuff ) && (
        stuff.type === "jsonwsp/response" &&
        stuff.version === "1.0" &&
        stuff.servicename === "ogmios"
    );
}

type OgmiosTag = "spend" | "mint" | "certificate" | "withdrawal";

interface OgmiosRdmrExUnits {
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

function _getRealTxRedeemers( tx: Tx, ogmiosRdmrs: OgmiosRdmrExUnits[] ): TxRedeemer[]
{
    const rdmrs = (tx.witnesses.redeemers ?? []).slice();
    const result: TxRedeemer[] = new Array( rdmrs.length );

    for( const { tag, index, exunits } of ogmiosRdmrs )
    {
        const idx = rdmrs.findIndex( rdmr => rdmr.tag === tag && rdmr.index === index );
        if( idx < 0 ) throw new Error("missing redemeer");
        const rdmr = rdmrs[idx];
        result[idx] = new TxRedeemer({
            tag: rdmr.tag,
            index: rdmr.index,
            data: rdmr.data.clone(),
            execUnits: new ExBudget( exunits )
        });
    }

    for( let i = 0; i < result.length; i++ )
    {
        if( result[i] === undefined ) result[i] = rdmrs[i].clone();
    }

    return result;
}

export function getRealTxRedeemers( tx: Tx, response: any ): TxRedeemer[]
{
    // if( !isOgmios5EvalTxResponse( response ) ) throw new Error("unexpected response; expected ogmios 5.6 EvalTx response");
    if( !response.result ) throw new Error( "Missing Ogmios result: " + (response.fault?.string ?? ""));

    return _getRealTxRedeemers(
        tx,
        ogmiosEvalTxResultToPartialTxRdmrs(
            response.result?.EvaluationResult ?? response.result
        )
    );
}