import { getRpcServer } from "../config/stellar";
import { Network } from "../config/stellar";

// Stellar fee constants (CAP-0046)
// 1 XLM = 10_000_000 stroops
const STROOPS_PER_XLM = 10_000_000n;

// Soroban resource fee rate constants (network defaults, used as fallback)
// These match Stellar's published defaults for fee calculation
const DEFAULT_FEE_RATE_PER_INSTRUCTION_INCREMENT = 25n; // stroops per 10k instructions
const INSTRUCTION_INCREMENT = 10_000n;
const DEFAULT_WRITE_FEE_PER_BYTE = 1_000n; // stroops per byte of write bandwidth
const DEFAULT_READ_FEE_PER_BYTE = 250n; // stroops per byte of read bandwidth
const DEFAULT_HISTORICAL_FEE_RATE = 100n; // stroops per byte of historical data
const DEFAULT_METADATA_FEE_RATE = 100n; // stroops per byte of metadata

// Typical overhead bytes for a Soroban transaction (approximate)
const TYPICAL_TX_OVERHEAD_BYTES = 300n;

export interface FeeEstimate {
  baseFee: string;
  resourceFee: string;
  totalFee: string;
  feeInXLM: string;
}

/**
 * Fetch the recommended inclusion fee (p50 of recent Soroban transactions)
 * from the RPC getFeeStats endpoint.
 */
async function fetchRecommendedInclusionFee(
  network: Network,
): Promise<bigint> {
  try {
    const server = getRpcServer(network);
    const stats = await server.getFeeStats();
    // Use p50 of soroban inclusion fees as the recommended base fee
    const p50 = BigInt(stats.sorobanInclusionFee.p50 ?? "100");
    return p50 > 0n ? p50 : 100n;
  } catch {
    return 100n; // fallback: 100 stroops (Stellar minimum base fee)
  }
}

/**
 * Estimate the Soroban resource fee from CPU instructions and memory bytes.
 *
 * Uses Stellar's CAP-0046 resource fee formula:
 *   cpuFee  = ceil(cpuInsns / 10_000) * feeRatePerInstructionIncrement
 *   memFee  = memBytes * writeFeePerByte
 *   overhead = TYPICAL_TX_OVERHEAD_BYTES * (historicalFeeRate + metadataFeeRate)
 *   resourceFee = cpuFee + memFee + overhead
 *
 * @param cpuInsns - CPU instructions from simulation cost (as string)
 * @param memBytes - Memory bytes from simulation cost (as string)
 * @returns Estimated resource fee in stroops (as bigint)
 */
function estimateResourceFee(cpuInsns: bigint, memBytes: bigint): bigint {
  const cpuFee =
    ((cpuInsns + INSTRUCTION_INCREMENT - 1n) / INSTRUCTION_INCREMENT) *
    DEFAULT_FEE_RATE_PER_INSTRUCTION_INCREMENT;

  const memFee = memBytes * DEFAULT_WRITE_FEE_PER_BYTE;

  const overhead =
    TYPICAL_TX_OVERHEAD_BYTES *
    (DEFAULT_HISTORICAL_FEE_RATE + DEFAULT_METADATA_FEE_RATE);

  // Read bandwidth fee (approximate: memBytes are also read)
  const readFee = memBytes * DEFAULT_READ_FEE_PER_BYTE;

  return cpuFee + memFee + readFee + overhead;
}

/**
 * Estimate fees for a Soroban transaction given simulation cost output.
 *
 * @param cpuInsns - CPU instructions used (as string, from simulation cost)
 * @param memBytes - Memory bytes used (as string, from simulation cost)
 * @param network  - Stellar network ("testnet" | "mainnet")
 * @returns Fee breakdown: baseFee, resourceFee, totalFee (all in stroops), feeInXLM
 */
export async function estimateFee(
  cpuInsns: string,
  memBytes: string,
  network: Network = "testnet",
): Promise<FeeEstimate> {
  const cpu = BigInt(cpuInsns);
  const mem = BigInt(memBytes);

  const [baseFee, resourceFee] = await Promise.all([
    fetchRecommendedInclusionFee(network),
    Promise.resolve(estimateResourceFee(cpu, mem)),
  ]);

  const totalFee = baseFee + resourceFee;
  // Convert stroops to XLM with 7 decimal places
  const xlmWhole = totalFee / STROOPS_PER_XLM;
  const xlmFrac = totalFee % STROOPS_PER_XLM;
  const feeInXLM = `${xlmWhole}.${xlmFrac.toString().padStart(7, "0")}`;

  return {
    baseFee: baseFee.toString(),
    resourceFee: resourceFee.toString(),
    totalFee: totalFee.toString(),
    feeInXLM,
  };
}
