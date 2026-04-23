# JavaScript Integration Example

This example demonstrates the full simulate → assemble → sign → submit flow using JavaScript.

## Prerequisites

- Node.js installed
- A Stellar testnet account with funds (friendbot can be used)
- The Stellar Footprint Service running (default: http://localhost:8080)

## Code

```javascript
const StellarSdk = require("stellar-sdk");
const fetch = require("node-fetch");

// Configuration
const SERVICE_URL = "http://localhost:8080";
const NETWORK = StellarSdk.Networks.TESTNET;

// Initialize Stellar SDK
const server = new StellarSdk.Server("https://horizon-testnet.stellar.org");
const sourceKeypair = StellarSdk.Keypair.fromSecret("YOUR_TESTNET_SECRET_SEED"); // Replace with your secret seed

async function main() {
  try {
    // Step 1: Simulate the transaction
    console.log("Step 1: Simulating transaction...");
    const simulateResponse = await fetch(`${SERVICE_URL}/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        network: "testnet",
        // Add your transaction simulation parameters here
        // Example: { operation: 'payment', destination: 'GA...', amount: '10' }
      }),
    });

    if (!simulateResponse.ok) {
      throw new Error(`Simulation failed: ${await simulateResponse.text()}`);
    }

    const simulateData = await simulateResponse.json();
    console.log("Simulation successful:", simulateData);

    // Step 2: Assemble the transaction
    console.log("\nStep 2: Assembling transaction...");
    const assembleResponse = await fetch(`${SERVICE_URL}/assemble`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(simulateData),
    });

    if (!assembleResponse.ok) {
      throw new Error(`Assembly failed: ${await assembleResponse.text()}`);
    }

    const assembleData = await assembleResponse.json();
    console.log("Assembly successful:", assembleData);

    // Step 3: Sign the transaction
    console.log("\nStep 3: Signing transaction...");
    const transaction = new StellarSdk.Transaction(assembleData.xdr, NETWORK);
    transaction.sign(sourceKeypair);
    const signedXdr = transaction.toEnvelope().toXDR();
    console.log("Transaction signed");

    // Step 4: Submit the transaction
    console.log("\nStep 4: Submitting transaction...");
    const submitResponse = await fetch(`${SERVICE_URL}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signed_xdr: signedXdr }),
    });

    if (!submitResponse.ok) {
      throw new Error(`Submission failed: ${await submitResponse.text()}`);
    }

    const submitData = await submitResponse.json();
    console.log("Submission successful:", submitData);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
```

## Expected Output

```
Step 1: Simulating transaction...
Simulation successful: { ... }
Step 2: Assembling transaction...
Assembly successful: { ... }
Step 3: Signing transaction...
Transaction signed
Step 4: Submitting transaction...
Submission successful: { ... }
```

## Error Handling

Each step includes error handling for network issues, invalid responses, and service errors. The example will log descriptive error messages to help with debugging.

## Testnet Usage

This example uses the Stellar testnet network. Ensure you have a testnet account with sufficient funds to cover transaction fees. You can obtain testnet funds using [Stellar's Friendbot](https://www.stellar.org/developers/learn/funding-account.html).
