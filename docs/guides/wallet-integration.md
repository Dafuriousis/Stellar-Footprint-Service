# Freighter Wallet Integration Guide

This guide shows how to wire up the Stellar Footprint Service with the [Freighter](https://www.freighter.app/) browser wallet to build the full **simulate → sign → submit** flow.

---

## Prerequisites

- Freighter browser extension installed ([freighter.app](https://www.freighter.app/))
- A deployed Soroban contract on testnet
- This service running locally or deployed (see [deployment guide](../deployment.md))

## Install the Freighter API

```bash
npm install @stellar/freighter-api @stellar/stellar-sdk
```

---

## Step 1 — Check Freighter is Available

Before doing anything, confirm the extension is installed and the user is connected.

```javascript
import { isConnected, getPublicKey, requestAccess } from "@stellar/freighter-api";

async function connectWallet() {
  const connected = await isConnected();
  if (!connected) {
    throw new Error("Freighter extension not found. Install it at freighter.app");
  }

  // Request permission to access the user's public key
  await requestAccess();

  const publicKey = await getPublicKey();
  return publicKey;
}
```

---

## Step 2 — Build an Unsigned Transaction

Build a transaction using the user's public key. At this stage the footprint is unknown — that's what the service will fill in.

```javascript
import * as StellarSdk from "@stellar/stellar-sdk";

async function buildTransaction(publicKey, contractId, network = "testnet") {
  const rpcUrl =
    network === "mainnet"
      ? "https://mainnet.stellar.validationcloud.io/v1/<YOUR_API_KEY>"
      : "https://soroban-testnet.stellar.org";

  const server = new StellarSdk.SorobanRpc.Server(rpcUrl);
  const account = await server.getAccount(publicKey);

  const contract = new StellarSdk.Contract(contractId);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase:
      network === "mainnet"
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call("your_method_name" /* ...args */))
    .setTimeout(30)
    .build();

  return tx.toXDR();
}
```

---

## Step 3 — Simulate via the Footprint Service

Send the unsigned XDR to the service to get back the footprint and resource costs.

```javascript
const SERVICE_URL = "http://localhost:3000"; // or your deployed URL

async function simulate(xdr, network = "testnet") {
  const response = await fetch(`${SERVICE_URL}/api/v1/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xdr, network }),
  });

  const envelope = await response.json();

  if (!envelope.success) {
    // Service returns { success: false, error: "..." }
    throw new Error(`Simulation failed: ${envelope.error}`);
  }

  // envelope.data contains { footprint, cost, ... }
  return envelope.data;
}
```

---

## Step 4 — Assemble the Transaction with the Footprint

Use the footprint returned by the service to rebuild the transaction with correct resource data.

```javascript
import * as StellarSdk from "@stellar/stellar-sdk";

function assembleTransaction(xdr, simulationResult, network = "testnet") {
  const networkPassphrase =
    network === "mainnet"
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;

  const tx = StellarSdk.TransactionBuilder.fromXDR(xdr, networkPassphrase);

  const { readOnly, readWrite } = simulationResult.footprint;

  const sorobanData = new StellarSdk.SorobanDataBuilder()
    .setReadOnly(readOnly.map((e) => StellarSdk.xdr.LedgerKey.fromXDR(e, "base64")))
    .setReadWrite(readWrite.map((e) => StellarSdk.xdr.LedgerKey.fromXDR(e, "base64")))
    .build();

  const assembledTx = StellarSdk.TransactionBuilder.cloneFrom(tx)
    .setSorobanData(sorobanData)
    .build();

  return assembledTx.toXDR();
}
```

---

## Step 5 — Sign with Freighter

Pass the assembled XDR to Freighter for the user to sign. This opens the Freighter popup.

```javascript
import { signTransaction } from "@stellar/freighter-api";

async function signWithFreighter(xdr, network = "testnet") {
  const networkPassphrase =
    network === "mainnet"
      ? "Public Global Stellar Network ; September 2015"
      : "Test SDF Network ; September 2015";

  try {
    const signedXdr = await signTransaction(xdr, {
      networkPassphrase,
    });
    return signedXdr;
  } catch (err) {
    // User rejected the signing request in Freighter
    if (err.message?.includes("User declined")) {
      throw new Error("Transaction rejected: the user cancelled signing.");
    }
    throw err;
  }
}
```

---

## Step 6 — Submit to the Network

Submit the signed transaction to the Stellar RPC.

```javascript
async function submitTransaction(signedXdr, network = "testnet") {
  const rpcUrl =
    network === "mainnet"
      ? "https://mainnet.stellar.validationcloud.io/v1/<YOUR_API_KEY>"
      : "https://soroban-testnet.stellar.org";

  const server = new StellarSdk.SorobanRpc.Server(rpcUrl);
  const networkPassphrase =
    network === "mainnet"
      ? StellarSdk.Networks.PUBLIC
      : StellarSdk.Networks.TESTNET;

  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const result = await server.sendTransaction(tx);

  if (result.status === "ERROR") {
    throw new Error(`Submission failed: ${result.errorResult?.toXDR("base64")}`);
  }

  return result; // { id, status } — poll result.id for final status
}
```

---

## Putting It All Together

Here is the complete flow as a single function with error handling for each stage.

```javascript
import { isConnected, getPublicKey, requestAccess, signTransaction } from "@stellar/freighter-api";
import * as StellarSdk from "@stellar/stellar-sdk";

const SERVICE_URL = "http://localhost:3000";
const CONTRACT_ID = "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const NETWORK = "testnet";

async function runTransaction() {
  // 1. Connect wallet
  if (!(await isConnected())) {
    throw new Error("Freighter not installed.");
  }
  await requestAccess();
  const publicKey = await getPublicKey();
  console.log("Connected:", publicKey);

  // 2. Build unsigned transaction
  const rpcUrl = "https://soroban-testnet.stellar.org";
  const server = new StellarSdk.SorobanRpc.Server(rpcUrl);
  const account = await server.getAccount(publicKey);
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const unsignedTx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call("your_method_name"))
    .setTimeout(30)
    .build();

  const unsignedXdr = unsignedTx.toXDR();

  // 3. Simulate — get footprint from service
  const simResponse = await fetch(`${SERVICE_URL}/api/v1/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xdr: unsignedXdr, network: NETWORK }),
  });
  const simEnvelope = await simResponse.json();

  if (!simEnvelope.success) {
    throw new Error(`Simulation failed: ${simEnvelope.error}`);
  }

  const { footprint } = simEnvelope.data;

  // 4. Assemble transaction with footprint
  const sorobanData = new StellarSdk.SorobanDataBuilder()
    .setReadOnly(footprint.readOnly.map((e) => StellarSdk.xdr.LedgerKey.fromXDR(e, "base64")))
    .setReadWrite(footprint.readWrite.map((e) => StellarSdk.xdr.LedgerKey.fromXDR(e, "base64")))
    .build();

  const assembledXdr = StellarSdk.TransactionBuilder.cloneFrom(unsignedTx)
    .setSorobanData(sorobanData)
    .build()
    .toXDR();

  // 5. Sign with Freighter
  let signedXdr;
  try {
    signedXdr = await signTransaction(assembledXdr, {
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  } catch (err) {
    if (err.message?.includes("User declined")) {
      console.warn("User cancelled the transaction.");
      return;
    }
    throw err;
  }

  // 6. Submit
  const submitResult = await server.sendTransaction(
    StellarSdk.TransactionBuilder.fromXDR(signedXdr, StellarSdk.Networks.TESTNET)
  );

  if (submitResult.status === "ERROR") {
    throw new Error(`Submission failed: ${submitResult.errorResult?.toXDR("base64")}`);
  }

  console.log("Transaction submitted:", submitResult.id, "Status:", submitResult.status);
  return submitResult;
}
```

---

## Error Handling Reference

| Error | Cause | Fix |
|---|---|---|
| `Freighter extension not found` | Extension not installed | Direct user to [freighter.app](https://www.freighter.app/) |
| `User declined` | User rejected in Freighter popup | Show a dismissible UI message, do not retry automatically |
| `Simulation failed: ...` | Invalid XDR or RPC issue | Log `envelope.error` and surface it to the user |
| `Submission failed: ...` | On-chain rejection | Decode the error XDR for details |
| `Transaction requires ledger entry restoration` | Expired ledger entries | Call `POST /api/v1/restore` first, submit the restore tx, then retry |

### Handling the Restore Case

If simulation returns a restoration error, use the `/restore` endpoint before retrying:

```javascript
if (simEnvelope.error?.includes("restoration")) {
  const restoreResponse = await fetch(`${SERVICE_URL}/api/v1/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xdr: unsignedXdr, network: NETWORK }),
  });
  const restoreEnvelope = await restoreResponse.json();

  // Sign and submit the restore transaction first
  const signedRestoreXdr = await signTransaction(restoreEnvelope.data.xdr, {
    networkPassphrase: "Test SDF Network ; September 2015",
  });
  await server.sendTransaction(
    StellarSdk.TransactionBuilder.fromXDR(signedRestoreXdr, StellarSdk.Networks.TESTNET)
  );

  // Then retry the original flow
}
```
