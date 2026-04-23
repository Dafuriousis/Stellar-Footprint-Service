import type { FootprintEntry } from "./footprintParser";

/**
 * Result of footprint optimization
 */
export interface OptimizationResult {
  readOnly: FootprintEntry[];
  readWrite: FootprintEntry[];
  optimized: boolean;
  rawFootprint: {
    readOnly: FootprintEntry[];
    readWrite: FootprintEntry[];
  };
  stats: {
    originalReadOnlyCount: number;
    optimizedReadOnlyCount: number;
    removedCount: number;
  };
}

/**
 * MD5-like hash for string comparison (simple hash for footprint keys)
 * Using a simple hash for demonstration since full cryptographic hashing would require additional deps
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Optimize footprint by removing read-only entries that are already in read-write
 * Entries in readWrite imply read access, so redundant readOnly entries can be removed
 *
 * @param readOnly - Array of read-only footprint entries
 * @param readWrite - Array of read-write footprint entries
 * @returns Optimized footprint with redundant entries removed
 */
export function optimizeFootprint(
  readOnly: FootprintEntry[],
  readWrite: FootprintEntry[],
): OptimizationResult {
  // Create a set of XDR hashes from readWrite entries for fast lookup
  const readWriteKeys = new Set(readWrite.map((e) => simpleHash(e.xdr)));

  // Filter out readOnly entries that are also in readWrite
  const optimizedReadOnly = readOnly.filter((entry) => {
    const key = simpleHash(entry.xdr);
    return !readWriteKeys.has(key);
  });

  const removedCount = readOnly.length - optimizedReadOnly.length;
  const optimized = removedCount > 0;

  return {
    readOnly: optimizedReadOnly,
    readWrite,
    optimized,
    rawFootprint: {
      readOnly,
      readWrite,
    },
    stats: {
      originalReadOnlyCount: readOnly.length,
      optimizedReadOnlyCount: optimizedReadOnly.length,
      removedCount,
    },
  };
}
