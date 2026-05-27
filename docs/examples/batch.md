# Batch Simulation Examples

The `POST /api/simulate/batch` endpoint simulates multiple transactions in a single request. Results are returned in the same order as the input, with each entry indicating success or failure independently.

## Request Format

```json
{
  "transactions": [
    { "xdr": "AAAAAgAAAAC..." },
    { "xdr": "AAAAAgAAAAD..." }
  ],
  "network": "testnet"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `transactions` | array | ✅ | Array of `{ xdr }` objects (max 100) |
| `network` | string | ❌ | `"testnet"` or `"mainnet"` (default: `"testnet"`) |

## Response Format

```json
{
  "results": [
    {
      "index": 0,
      "success": true,
      "footprint": { "readOnly": ["..."], "readWrite": ["..."] },
      "cost": { "cpuInsns": "1234567", "memBytes": "8192" }
    },
    {
      "index": 1,
      "success": false,
      "error": "Transaction requires ledger entry restoration before simulation."
    }
  ]
}
```

The response header `X-Cache` reflects cache status: `HIT`, `MISS`, or `PARTIAL` (some entries cached, some not).

---

## curl

```bash
curl -X POST http://localhost:3000/api/simulate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      { "xdr": "AAAAAgAAAAC..." },
      { "xdr": "AAAAAgAAAAD..." },
      { "xdr": "AAAAAgAAAAE..." }
    ],
    "network": "testnet"
  }'
```

Handling mixed results with `jq`:

```bash
curl -s -X POST http://localhost:3000/api/simulate/batch \
  -H "Content-Type: application/json" \
  -d '{"transactions":[{"xdr":"AAAAAgAAAAC..."},{"xdr":"AAAAAgAAAAD..."}],"network":"testnet"}' \
| jq '.results[] | if .success then "[\(.index)] OK: \(.cost.cpuInsns) cpu" else "[\(.index)] FAIL: \(.error)" end'
```

---

## JavaScript

```javascript
const SERVICE_URL = "http://localhost:3000";

async function simulateBatch(xdrList, network = "testnet") {
  const response = await fetch(`${SERVICE_URL}/api/simulate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactions: xdrList.map((xdr) => ({ xdr })),
      network,
    }),
  });

  if (!response.ok) {
    throw new Error(`Batch request failed: ${response.status}`);
  }

  const { results } = await response.json();

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`${succeeded.length} succeeded, ${failed.length} failed`);

  for (const result of failed) {
    console.error(`[${result.index}] ${result.error}`);
  }

  return results;
}

// Usage
const xdrList = [
  "AAAAAgAAAAC...",
  "AAAAAgAAAAD...",
  "AAAAAgAAAAE...",
];

simulateBatch(xdrList).then((results) => {
  for (const r of results) {
    if (r.success) {
      console.log(`[${r.index}] readOnly: ${r.footprint.readOnly.length}, readWrite: ${r.footprint.readWrite.length}`);
    }
  }
});
```

---

## TypeScript

```typescript
const SERVICE_URL = "http://localhost:3000";

interface FootprintResult {
  index: number;
  success: true;
  footprint: { readOnly: string[]; readWrite: string[] };
  cost: { cpuInsns: string; memBytes: string };
  cacheHit?: boolean;
}

interface FailureResult {
  index: number;
  success: false;
  error: string;
}

type BatchResult = FootprintResult | FailureResult;

async function simulateBatch(
  xdrList: string[],
  network: "testnet" | "mainnet" = "testnet",
): Promise<BatchResult[]> {
  const response = await fetch(`${SERVICE_URL}/api/simulate/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactions: xdrList.map((xdr) => ({ xdr })),
      network,
    }),
  });

  if (!response.ok) {
    throw new Error(`Batch request failed: ${response.status}`);
  }

  const { results }: { results: BatchResult[] } = await response.json();
  return results;
}

// Usage
const xdrList = ["AAAAAgAAAAC...", "AAAAAgAAAAD..."];

simulateBatch(xdrList).then((results) => {
  for (const result of results) {
    if (result.success) {
      console.log(`[${result.index}] cpu: ${result.cost.cpuInsns}`);
    } else {
      console.error(`[${result.index}] error: ${result.error}`);
    }
  }
});
```

---

## Python

```python
import requests

SERVICE_URL = "http://localhost:3000"

def simulate_batch(xdr_list: list[str], network: str = "testnet") -> list[dict]:
    response = requests.post(
        f"{SERVICE_URL}/api/simulate/batch",
        json={
            "transactions": [{"xdr": xdr} for xdr in xdr_list],
            "network": network,
        },
    )
    response.raise_for_status()
    return response.json()["results"]


# Usage
xdr_list = [
    "AAAAAgAAAAC...",
    "AAAAAgAAAAD...",
    "AAAAAgAAAAE...",
]

results = simulate_batch(xdr_list)

succeeded = [r for r in results if r["success"]]
failed = [r for r in results if not r["success"]]

print(f"{len(succeeded)} succeeded, {len(failed)} failed")

for r in succeeded:
    print(f"[{r['index']}] readOnly={len(r['footprint']['readOnly'])}, cpu={r['cost']['cpuInsns']}")

for r in failed:
    print(f"[{r['index']}] ERROR: {r['error']}")
```

---

## Notes

- The batch endpoint processes transactions concurrently (controlled by `BATCH_CONCURRENCY`, default `5`).
- Maximum batch size is `100` (controlled by `BATCH_MAX_SIZE` in the ConfigMap).
- A single failed transaction does not fail the entire batch — check each result's `success` field.
- The `index` field in each result corresponds to the position in the input `transactions` array.
