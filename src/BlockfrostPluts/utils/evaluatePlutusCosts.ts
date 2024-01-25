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
    if( !isObject( result ) ) return [];

    const keys = Object.keys( result );
    let realLen = 0;
    const rdmrs: OgmiosRdmrExUnits[] = new Array( keys.length );
    
    for( const k of keys )
    {
        const [ tagStr, idxStr ] = k.split(":");
        switch( tagStr )
        {
            case "withdrawal":
            case "certificate":
            case "mint":
            case "spend": {
                rdmrs.push({
                    tag: adaptOgmiosTag( tagStr ),
                    index: parseInt( idxStr ),
                    exunits: {
                        mem: result[k].memory,
                        cpu: result[k].steps
                    }
                });
                realLen++;
                break;
            }
            default: break;
        }
    }

    rdmrs.length = realLen;
    return rdmrs;
}

function _getRealTxRedeemers( tx: Tx, ogmiosRdmrs: OgmiosRdmrExUnits[] ): TxRedeemer[]
{
    const rdmrs = (tx.witnesses.redeemers ?? []).slice();

    for( const { tag, index, exunits } of ogmiosRdmrs )
    {
        const idx = rdmrs.findIndex( rdmr => rdmr.tag === tag && rdmr.index === index );
        if( idx < 0 ) continue;
        const rdmr = rdmrs[idx];
        rdmrs[idx] = new TxRedeemer({
            ...rdmr,
            execUnits: new ExBudget( exunits )
        });
    }

    return rdmrs;
}

export function getRealTxRedeemers( tx: Tx, response: any ): TxRedeemer[]
{
    // if( !isOgmios5EvalTxResponse( response ) ) throw new Error("unexpected response; expected ogmios 5.6 EvalTx response");
    return _getRealTxRedeemers(
        tx,
        ogmiosEvalTxResultToPartialTxRdmrs(
            response.result
        )
    );
}