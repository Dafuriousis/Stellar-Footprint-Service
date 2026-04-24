import { Network, getRpcServer, getNetworkConfig } from "../config/stellar";

export interface NetworkStatusResult {
  ledger: number;
  baseFee: string;
  networkPassphrase: string;
  rpcLatencyMs: number;
}

interface CachedStatus {
  data: NetworkStatusResult;
  timestamp: number;
}

const cache = new Map<Network, CachedStatus>();
const CACHE_TTL_MS = 10000;

export async function getNetworkStatus(
  network: Network = "testnet",
): Promise<NetworkStatusResult> {
  const now = Date.now();
  const cached = cache.get(network);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const server = getRpcServer(network);
  const { networkPassphrase } = getNetworkConfig(network);
  const startTime = Date.now();

  const latestLedger = await server.getLatestLedger();
  const rpcLatencyMs = Date.now() - startTime;

  const result: NetworkStatusResult = {
    ledger: latestLedger.sequence,
    baseFee: "100",
    networkPassphrase,
    rpcLatencyMs,
  };

  cache.set(network, { data: result, timestamp: now });
  return result;
}
