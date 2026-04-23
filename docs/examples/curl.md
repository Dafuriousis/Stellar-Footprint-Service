# cURL Integration Example

This example demonstrates the full simulate → assemble → sign → submit flow using cURL.

## Prerequisites

- cURL installed
- jq for JSON parsing (optional but recommended)
- A Stellar testnet account with funds (friendbot can be used)
- The Stellar Footprint Service running (default: http://localhost:8080)

## Code

```bash
#!/bin/bash

# Configuration
SERVICE_URL="http://localhost:8080"
NETWORK="testnet"
# Replace with your testnet secret seed
SECRET_SEED="YOUR_TESTNET_SECRET_SEED"
# Replace with your testnet public key
PUBLIC_KEY="GA..."

# Helper function to make POST requests
post_json() {
  local endpoint="$1"
  local data="$2"
  curl -s -X POST "$SERVICE_URL/$endpoint" \
    -H "Content-Type: application/json" \
    -d "$data"
}

# Step 1: Simulate the transaction
echo "Step 1: Simulating transaction..."
SIMULATE_RESPONSE=$(post_json "simulate" '{
  "network": "'"$NETWORK"'",
  # Add your transaction simulation parameters here
  # Example: { "operation": "payment", "destination": "GA...", "amount": "10" }
}')

if [ $? -ne 0 ]; then
  echo "Simulation failed: $SIMULATE_RESPONSE"
  exit 1
fi

echo "Simulation successful:"
echo "$SIMULATE_RESPONSE" | jq .

# Extract the necessary data for the next step (adjust based on actual response structure)
# For example, if the simulation response contains a transaction object:
# SIMULATED_TX=$(echo "$SIMULATE_RESPONSE" | jq -r '.transaction')

# Step 2: Assemble the transaction
echo -e "\nStep 2: Assembling transaction..."
ASSEMBLE_RESPONSE=$(post_json "assemble" "$SIMULATE_RESPONSE")

if [ $? -ne 0 ]; then
  echo "Assembly failed: $ASSEMBLE_RESPONSE"
  exit 1
fi

echo "Assembly successful:"
echo "$ASSEMBLE_RESPONSE" | jq .

# Extract the XDR from the assembly response
SIGNED_XDR=$(echo "$ASSEMBLE_RESPONSE" | jq -r '.xdr')

# Step 3: Sign the transaction (using Stellar Laboratory or SDK is recommended for signing)
# Note: cURL alone cannot sign transactions. This step requires the Stellar SDK or similar.
# For the purpose of this example, we assume you have a way to sign the XDR.
# In practice, you would use a library like stellar-sdk to sign the transaction.
echo -e "\nStep 3: Signing transaction..."
echo "This step requires the Stellar SDK or similar to sign the transaction XDR."
echo "Please use a library to sign the following XDR with your secret seed:"
echo "$SIGNED_XDR"
# After signing, you would have a signed XDR to submit.

# Step 4: Submit the transaction
# Replace SIGNED_XDR_AFTER_SIGNING with the actual signed XDR
echo -e "\nStep 4: Submitting transaction..."
echo "Please replace SIGNED_XDR_AFTER_SIGNING with the signed XDR from step 3."
# SUBMIT_RESPONSE=$(post_json "submit" '{
#   "signed_xdr": "SIGNED_XDR_AFTER_SIGNING"
# }')
# if [ $? -ne 0 ]; then
#   echo "Submission failed: $SUBMIT_RESPONSE"
#   exit 1
# fi
# echo "Submission successful:"
# echo "$SUBMIT_RESPONSE" | jq .
```

## Expected Output

```
Step 1: Simulating transaction...
Simulation successful: { ... }

Step 2: Assembling transaction...
Assembly successful: { ... }

Step 3: Signing transaction...
This step requires the Stellar SDK or similar to sign the transaction XDR.
Please use a library to sign the following XDR with your secret seed:
...

Step 4: Submitting transaction...
Please replace SIGNED_XDR_AFTER_SIGNING with the signed XDR from step 3.
```

## Error Handling

Each step includes error checking for cURL exit status and will exit with an error message if a step fails.

## Testnet Usage

This example uses the Stellar testnet network. Ensure you have a testnet account with sufficient funds to cover transaction fees. You can obtain testnet funds using [Stellar's Friendbot](https://www.stellar.org/developers/learn/funding-account.html).

## Note on Signing

Signing a transaction requires the Stellar SDK or similar library because it involves cryptographic operations. This cURL example focuses on the API interactions and assumes you have a way to sign the transaction XDR (e.g., using the Stellar SDK in another language or using Stellar Laboratory).
