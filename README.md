# @harmoniclabs/blockfrost-pluts

wrapper over the `@blockfrost/blockfrost-js` SDK based on the `@harmoniclabs/cardano-ledger-ts` types.

## Installation

```bash
npm install @harmoniclabs/blockfrost-pluts
```

## Quick start

Build you blockfrost provider and wrap it in a `BlockfrostPluts` instance

```ts
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";

const api = new BlockFrostAPI({
    projectId: "YOUR API KEY HERE", // see: https://blockfrost.io
});

const provider = new BlockfrostPluts( api );
```

or directly pass the arguments to the wrapper class

```ts
import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";

const provider = new BlockfrostPluts({
    projectId: "YOUR API KEY HERE", // see: https://blockfrost.io
});
```

## Usage with `@harmoniclabs/plu-ts`

the provider can be used with the transaction builder to get a `TxBuilderRunner` instance:

```ts
import { TxBuilder, defaultProtocolParameters } from "@harmoniclabs/plu-ts";

const txBuilder = new TxBuilder( defaultProtocolParameters );

import { BlockfrostPluts } from "@harmoniclabs/blockfrost-pluts";

const provider = new BlockfrostPluts({
    projectId: "YOUR API KEY HERE", // see: https://blockfrost.io
});

const txRunner = txBuilder.runWithProvider( provider );
```

which you can use to easly build transacitons

```ts
const tx = await txRunner
    .addInput(
        contractUtxo,
        "40" // redeemer ( CBOR for empty bytestring )
    )
    .attachValidator( contractSource ) // `Script` instance
    .payTo( myAddress, 5_000_000 ) // send 5 ADA
    .build()
```