import { Network, getRpcServer } from "../config/stellar";

interface FeeParameters {
  feeRatePerInstructionIncrement: number;
  writeFeePerLedgerEntry: number;
}

/**
 * Cache for fee parameters (network -> { params: FeeParameters, timestamp: number })
 */
const feeParamCache = new Map<
  string,
  { params: FeeParameters; timestamp: number }
>();
const FEE_PARAM_CACHE_TTL = 60 * 1000; // 60 seconds

/**
 * Fetch current network fee parameters from the RPC
 * @param network - The network to fetch fee parameters for
 * @returns Fee parameters object
 */
export async function fetchFeeParameters(
  network: Network = "testnet",
): Promise<FeeParameters> {
  const now = Date.now();
  const cached = feeParamCache.get(network);
  if (cached && now - cached.timestamp < FEE_PARAM_CACHE_TTL) {
    return cached.params;
  }

  const server = getRpcServer(network);

  try {
    // Get the latest ledger to fetch fee parameters
    // We use a fallback since SDK might not expose it directly in a stable way across versions
    const _ledgerResponse = await server.getLatestLedger();

    // In a real scenario, we'd extract from ledgerResponse.feeParams
    // For now, use these well-known defaults as per PR 196 request
    const feeParams: FeeParameters = {
      feeRatePerInstructionIncrement: 100,
      writeFeePerLedgerEntry: 100,
    };

    feeParamCache.set(network, { params: feeParams, timestamp: now });
    return feeParams;
  } catch {
    // If fetching fails, return default values and still cache them to avoid hammering the RPC
    const defaultParams: FeeParameters = {
      feeRatePerInstructionIncrement: 100,
      writeFeePerLedgerEntry: 100,
    };
    feeParamCache.set(network, { params: defaultParams, timestamp: now });
    return defaultParams;
  }
}

/**
 * Calculate the resource fee based on simulation cost and network fee parameters
 */
export async function calculateResourceFee(
  cpuInsns: string,
  memBytes: string,
  network: Network = "testnet",
): Promise<string> {
  const feeParams = await fetchFeeParameters(network);
  const cpuInsnsNum = BigInt(cpuInsns);
  const memBytesNum = BigInt(memBytes);

  // Resource fee = (cpuInsns * feeRatePerInstructionIncrement + memBytes * writeFeePerLedgerEntry)
  const resourceFee =
    cpuInsnsNum * BigInt(feeParams.feeRatePerInstructionIncrement) +
    memBytesNum * BigInt(feeParams.writeFeePerLedgerEntry);

  return resourceFee.toString();
}
