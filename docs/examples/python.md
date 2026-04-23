# Python Integration Example

This example demonstrates the full simulate → assemble → sign → submit flow using Python.

## Prerequisites

- Python 3.6+
- `requests` library (`pip install requests`)
- `stellar-sdk` library (`pip install stellar-sdk`)
- A Stellar testnet account with funds (friendbot can be used)
- The Stellar Footprint Service running (default: http://localhost:8080)

## Code

```python
import requests
from stellar_sdk import Server, Keypair, TransactionEnvelope, Networks

# Configuration
SERVICE_URL = 'http://localhost:8080'
NETWORK = Networks.TESTNET

# Initialize Stellar SDK
server = Server('https://horizon-testnet.stellar.org')
source_keypair = Keypair.from_secret('YOUR_TESTNET_SECRET_SEED')  # Replace with your secret seed

def main():
    try:
        # Step 1: Simulate the transaction
        print('Step 1: Simulating transaction...')
        simulate_response = requests.post(
            f'{SERVICE_URL}/simulate',
            json={
                'network': 'testnet',
                # Add your transaction simulation parameters here
                # Example: {'operation': 'payment', 'destination': 'GA...', 'amount': '10'}
            }
        )
        simulate_response.raise_for_status()
        simulate_data = simulate_response.json()
        print('Simulation successful:', simulate_data)

        # Step 2: Assemble the transaction
        print('\nStep 2: Assembling transaction...')
        assemble_response = requests.post(
            f'{SERVICE_URL}/assemble',
            json=simulate_data
        )
        assemble_response.raise_for_status()
        assemble_data = assemble_response.json()
        print('Assembly successful:', assemble_data)

        # Step 3: Sign the transaction
        print('\nStep 3: Signing transaction...')
        transaction = TransactionEnvelope.from_xdr(assemble_data['xdr'], NETWORK)
        transaction.sign(source_keypair)
        signed_xdr = transaction.to_xdr()
        print('Transaction signed')

        # Step 4: Submit the transaction
        print('\nStep 4: Submitting transaction...')
        submit_response = requests.post(
            f'{SERVICE_URL}/submit',
            json={'signed_xdr': signed_xdr}
        )
        submit_response.raise_for_status()
        submit_data = submit_response.json()
        print('Submission successful:', submit_data)
    except Exception as e:
        print(f'Error: {e}')

if __name__ == '__main__':
    main()
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

Each step includes error handling for network issues, invalid responses, and service errors. The example will print descriptive error messages to help with debugging.

## Testnet Usage

This example uses the Stellar testnet network. Ensure you have a testnet account with sufficient funds to cover transaction fees. You can obtain testnet funds using [Stellar's Friendbot](https://www.stellar.org/developers/learn/funding-account.html).
