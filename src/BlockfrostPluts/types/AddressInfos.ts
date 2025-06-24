import { Address, StakeAddress, Value } from "@harmoniclabs/buildooor";

export interface AddressInfos {
    address: Address;
    totAmount: Value;
    stakeAddress?: StakeAddress;
    type: "shelley" | "byron";
    script: boolean;
}