import { Network, getRpcServer, getNetworkConfig } from "../config/stellar";
import { CACHE_TTL } from "../constants";

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

function getTtlMs(): number {
  const fromEnv = parseInt(process.env.NETWORK_STATUS_TTL_MS ?? "", 10);
  return Number.isFinite(fromEnv) && fromEnv > 0
    ? fromEnv
    : CACHE_TTL.NETWORK_STATUS_MS;
}

export async function getNetworkStatus(
  network: Network = "testnet",
): Promise<NetworkStatusResult> {
  const now = Date.now();
  const cached = cache.get(network);

  if (cached && now - cached.timestamp < getTtlMs()) {
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
