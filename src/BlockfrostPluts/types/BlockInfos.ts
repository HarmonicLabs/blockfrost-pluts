export interface BlockInfos {
    time: number,
    hight: number | null | undefined,
    hash: string,
    slot: number | null | undefined,
    epoch: number | null | undefined,
    epoch_slot: number | null | undefined,
    slot_leader: string,
    size: number,
    tx_count: number,
    output: `${bigint}` | null | undefined,
    fees: `${bigint}` | null | undefined,
    block_vrf: string | null | undefined,
    op_cert: string | null | undefined,
    op_cert_counter: `${bigint}` | null | undefined,
    previous_block: string | null | undefined,
    next_block: string | null | undefined,
    confirmations: number
}