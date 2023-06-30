import { Address, StakeAddress, Value } from "@harmoniclabs/cardano-ledger-ts";

export interface AddressInfos {
    address: Address;
    totAmount: Value;
    stakeAddress?: StakeAddress;
    type: "shelley" | "byron";
    script: boolean;
}