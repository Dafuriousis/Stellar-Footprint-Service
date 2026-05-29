import { validateXdr } from "../validator";
import { Network } from "../../config/stellar";
import * as StellarSdk from "@stellar/stellar-sdk";

describe("validateXdr", () => {
  const testnetPassphrase = StellarSdk.Networks.TESTNET;
  const mainnetPassphrase = StellarSdk.Networks.PUBLIC;

  // Helper to create a simple transaction with an invokeHostFunction operation
  const createTxWithInvokeHostFunction = (network: Network): string => {
    const pair = StellarSdk.Keypair.random();
    const networkPassphrase =
      network === "testnet" ? testnetPassphrase : mainnetPassphrase;

    // Create a dummy account (we don't need it to exist for XDR generation)
    const dummyAccount = StellarSdk.Keypair.random().publicKey();

    const transaction = new StellarSdk.TransactionBuilder(
      { account: dummyAccount, fee: "10000", networkPassphrase },
      { networkPassphrase }
    )
      .addOperation(
        StellarSdk.Operation.invokeHostFunction({
          hostFunction: StellarSdk.xdr.HostFunction.createContractFunc(
            StellarSdk.xdr.ScVal.createScvBytes(Uint8Array.from([1, 2, 3]))
          ),
        })
      )
      .setTimeout(StellarSdk.TimeoutInfinite)
      .build();

    return transaction.toXDR();
  };

  // Helper to create a simple transaction without invokeHostFunction (e.g., payment)
  const createTxWithoutInvokeHostFunction = (network: Network): string => {
    const pair = StellarSdk.Keypair.random();
    const networkPassphrase =
      network === "testnet" ? testnetPassphrase : mainnetPassphrase;

    const dummyAccount = StellarSdk.Keypair.random().publicKey();

    const transaction = new StellarSdk.TransactionBuilder(
      { account: dummyAccount, fee: "10000", networkPassphrase },
      { networkPassphrase }
    )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: StellarSdk.Keypair.random().publicKey(),
          amount: "10",
          asset: StellarSdk.Asset.native(),
        })
      )
      .setTimeout(StellarSdk.TimeoutInfinite)
      .build();

    return transaction.toXDR();
  };

  it("returns valid for a transaction with invokeHostFunction on correct network", () => {
    const txXDR = createTxWithInvokeHostFunction("testnet");
    const result = validateXdr(txXDR, "testnet");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("returns invalid for non-base64 string", () => {
    const result = validateXdr("not-base64!!!", "testnet");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Invalid XDR: must be valid base64");
  });

  it("returns invalid for base64 string that is not a valid transaction XDR", () => {
    // This is a valid base64 string but not a valid transaction XDR
    const result = validateXdr("AAAA", "testnet");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Failed to parse XDR as a transaction");
  });

  it("returns invalid for transaction without invokeHostFunction operation", () => {
    const txXDR = createTxWithoutInvokeHostFunction("testnet");
    const result = validateXdr(txXDR, "testnet");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Transaction must contain at least one Soroban invokeHostFunction operation"
    );
  });

  it("returns invalid when network does not match (wrong passphrase)", () => {
    // Create a transaction for testnet but validate with mainnet passphrase
    const txXDR = createTxWithInvokeHostFunction("testnet");
    const result = validateXdr(txXDR, "mainnet");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Failed to parse XDR as a transaction");
  });

  it("returns warning when transaction contains additional non-Soroban operations", () => {
    // Create a transaction with both a payment and an invokeHostFunction
    const pair = StellarSdk.Keypair.random();
    const dummyAccount = StellarSdk.Keypair.random().publicKey();
    const transaction = new StellarSdk.TransactionBuilder(
      { account: dummyAccount, fee: "10000", networkPassphrase: testnetPassphrase },
      { networkPassphrase: testnetPassphrase }
    )
      .addOperation(
        StellarSdk.Operation.payment({
          destination: StellarSdk.Keypair.random().publicKey(),
          amount: "10",
          asset: StellarSdk.Asset.native(),
        })
      )
      .addOperation(
        StellarSdk.Operation.invokeHostFunction({
          hostFunction: StellarSdk.xdr.HostFunction.createContractFunc(
            StellarSdk.xdr.ScVal.createScvBytes(Uint8Array.from([1, 2, 3]))
          ),
        })
      )
      .setTimeout(StellarSdk.TimeoutInfinite)
      .build();

    const txXDR = transaction.toXDR();
    const result = validateXdr(txXDR, "testnet");
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      expect.stringContaining("non-Soroban operation"),
    ]);
  });

  it("handles oversized XDR", () => {
    // Create a base64 string that is too long (over 100KB)
    const oversized = "A".repeat(101 * 1024); // 101KB of 'A's, which is valid base64? Not exactly, but we want to test the length check.
    // Actually, we need to make sure it's still base64 valid. We'll use a valid base64 character repeated.
    const base64Chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    const oversized = base64Chars.repeat(10000); // This will be way over 100KB
    const result = validateXdr(oversized, "testnet");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("XDR too large: maximum 100kb");
  });

  it("returns error for missing network configuration", () => {
    // We'll pass an invalid network string that is not in the configs
    // The function expects a Network type, but we can pass a string that is not "mainnet" or "testnet"
    // Since the parameter is typed as Network, we'll need to cast to bypass TypeScript in tests.
    // We'll use "invalid" as network.
    const result = validateXdr(
      "AAAA", // any xdr, will fail at base64 or parsing, but we want to test the network config error
      "invalid" as Network
    );
    // The function will first check base64, so it will fail at base64. We need to pass a valid base64
    // that is also a valid transaction XDR to get to the network config check.
    // Let's create a valid transaction XDR for testnet and then pass an invalid network.
    const txXDR = createTxWithInvokeHostFunction("testnet");
    const result2 = validateXdr(txXDR, "invalid" as Network);
    expect(result2.valid).toBe(false);
    expect(result2.errors).toContain(
      "Network configuration not found for: invalid"
    );
  });
});