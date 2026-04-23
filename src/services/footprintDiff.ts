import type { FootprintEntry } from "./footprintParser";

/**
 * Result of comparing two footprints
 */
export interface FootprintDiffResult {
  /** Entries added in the 'after' footprint */
  added: {
    readOnly: FootprintEntry[];
    readWrite: FootprintEntry[];
  };
  /** Entries removed in the 'after' footprint (present in 'before' but not in 'after') */
  removed: {
    readOnly: FootprintEntry[];
    readWrite: FootprintEntry[];
  };
}

/**
 * Compare two simulation results and return added/removed ledger keys
 * @param before - The before simulation result
 * @param after - The after simulation result
 * @returns Object containing added and removed entries for readOnly and readWrite footprints
 */
export function footprintDiff(
  before: {
    footprint?: {
      readOnly: FootprintEntry[];
      readWrite: FootprintEntry[];
    } | null;
  },
  after: {
    footprint?: {
      readOnly: FootprintEntry[];
      readWrite: FootprintEntry[];
    } | null;
  },
): FootprintDiffResult {
  // Handle undefined or null footprints
  const beforeFootprint = before.footprint ?? { readOnly: [], readWrite: [] };
  const afterFootprint = after.footprint ?? { readOnly: [], readWrite: [] };

  // Convert arrays to sets for efficient difference calculation
  const beforeReadOnlySet = new Set(
    beforeFootprint.readOnly.map((entry) => entry.xdr),
  );
  const beforeReadWriteSet = new Set(
    beforeFootprint.readWrite.map((entry) => entry.xdr),
  );
  const afterReadOnlySet = new Set(
    afterFootprint.readOnly.map((entry) => entry.xdr),
  );
  const afterReadWriteSet = new Set(
    afterFootprint.readWrite.map((entry) => entry.xdr),
  );

  // Find added entries (in after but not in before)
  const addedReadOnly = afterFootprint.readOnly.filter(
    (entry) => !beforeReadOnlySet.has(entry.xdr),
  );
  const addedReadWrite = afterFootprint.readWrite.filter(
    (entry) => !beforeReadWriteSet.has(entry.xdr),
  );

  // Find removed entries (in before but not in after)
  const removedReadOnly = beforeFootprint.readOnly.filter(
    (entry) => !afterReadOnlySet.has(entry.xdr),
  );
  const removedReadWrite = beforeFootprint.readWrite.filter(
    (entry) => !afterReadWriteSet.has(entry.xdr),
  );

  return {
    added: {
      readOnly: addedReadOnly,
      readWrite: addedReadWrite,
    },
    removed: {
      readOnly: removedReadOnly,
      readWrite: removedReadWrite,
    },
  };
}
