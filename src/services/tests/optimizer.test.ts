import type { FootprintEntry } from "../footprintParser";
import { optimizeFootprint } from "../optimizer";

const entry = (xdr: string): FootprintEntry => ({ xdr, type: "ContractData" });

const A = entry("entryA");
const B = entry("entryB");
const C = entry("entryC");

describe("optimizeFootprint", () => {
  it("removes readOnly entries that are also in readWrite", () => {
    const result = optimizeFootprint([A, B], [B, C]);
    expect(result.readOnly).toEqual([A]);
    expect(result.readWrite).toEqual([B, C]);
  });

  it("sets optimized: true when entries are removed", () => {
    const result = optimizeFootprint([A, B], [B]);
    expect(result.optimized).toBe(true);
    expect(result.stats.removedCount).toBe(1);
  });

  it("sets optimized: false when no entries are removed", () => {
    const result = optimizeFootprint([A], [B]);
    expect(result.optimized).toBe(false);
    expect(result.stats.removedCount).toBe(0);
  });

  it("returns empty outputs for empty inputs", () => {
    const result = optimizeFootprint([], []);
    expect(result.readOnly).toEqual([]);
    expect(result.readWrite).toEqual([]);
    expect(result.optimized).toBe(false);
  });

  it("preserves rawFootprint with original entries", () => {
    const result = optimizeFootprint([A, B], [B]);
    expect(result.rawFootprint.readOnly).toEqual([A, B]);
    expect(result.rawFootprint.readWrite).toEqual([B]);
  });
});
