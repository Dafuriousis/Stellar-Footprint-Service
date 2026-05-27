import { validateXdrInput } from "../validateXdrInput";

const VALID_XDR =
  "AAAAAgAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAGQAAAAAAAAAZwAAAAEAAAAAAAAAAAAAAABp6joKAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAABAAAAAQAAAAAAAAAAAAAAAfK5hNUAAABAIbPVF4x6vSLx/J3T0SDhvTNtytA/BNO+qMJ74p/b3Y8xpBhR7xzy68FuEyffaF9fNXHEC+77WK+oOJpfon1tCg==";

describe("validateXdrInput", () => {
  it("returns valid for a well-formed base64 XDR string", () => {
    expect(validateXdrInput(VALID_XDR)).toEqual({ valid: true });
  });

  it("returns error when xdr is missing (undefined)", () => {
    const result = validateXdrInput(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Missing required field: xdr/);
  });

  it("returns error when xdr is an empty string", () => {
    const result = validateXdrInput("");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Missing required field: xdr/);
  });

  it("returns error when xdr is not a string", () => {
    const result = validateXdrInput(42);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Missing required field: xdr/);
  });

  it("returns error when xdr contains non-base64 characters", () => {
    const result = validateXdrInput("not-valid-base64!!!");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid XDR: must be valid base64/);
  });

  it("returns error when xdr exceeds 100kb", () => {
    const oversized = "A".repeat(100 * 1024 + 1);
    const result = validateXdrInput(oversized);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/XDR too large/);
  });
});
