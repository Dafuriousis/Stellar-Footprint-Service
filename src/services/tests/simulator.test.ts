import { simulateTransaction } from "../simulator";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSimulateTransaction = jest.fn();
const mockGetLedgerEntries = jest.fn();

jest.mock("../../config/stellar", () => ({
  getNetworkConfig: jest.fn().mockReturnValue({
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    secretKey: "",
  }),
  getRpcServer: jest.fn().mockReturnValue({
    simulateTransaction: mockSimulateTransaction,
    getLedgerEntries: mockGetLedgerEntries,
  }),
}));

// Minimal XDR footprint builder helpers
const mockFootprint = {
  readOnly: jest.fn().mockReturnValue([]),
  readWrite: jest.fn().mockReturnValue([]),
};
const mockResources = jest.fn().mockReturnValue({ footprint: () => mockFootprint });
const mockBuild = jest.fn().mockReturnValue({ resources: mockResources, auth: jest.fn().mockReturnValue([]) });
const mockTransactionData = { build: mockBuild };

const mockTx = {};

jest.mock("@stellar/stellar-sdk", () => {
  const isSimulationError = jest.fn();
  const isSimulationRestore = jest.fn();

  return {
    TransactionBuilder: {
      fromXDR: jest.fn().mockReturnValue(mockTx),
    },
    SorobanRpc: {
      Server: jest.fn(),
      Api: { isSimulationError, isSimulationRestore },
    },
    Networks: {
      TESTNET: "Test SDF Network ; September 2015",
      PUBLIC: "Public Global Stellar Network ; September 2015",
    },
    xdr: {
      LedgerKey: {
        fromXDR: jest.fn().mockReturnValue({}),
        account: jest.fn().mockReturnValue({}),
        contractCode: jest.fn().mockReturnValue({}),
      },
      AccountId: { fromString: jest.fn().mockReturnValue({}) },
    },
  };
});

import * as StellarSdk from "@stellar/stellar-sdk";

const isSimulationError = StellarSdk.SorobanRpc.Api
  .isSimulationError as jest.Mock;
const isSimulationRestore = StellarSdk.SorobanRpc.Api
  .isSimulationRestore as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────────────

const DUMMY_XDR = "AAAAAA==";

function makeSuccessResponse() {
  return {
    transactionData: mockTransactionData,
    cost: { cpuInsns: "1000", memBytes: "2000" },
    error: undefined,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  isSimulationError.mockReturnValue(false);
  isSimulationRestore.mockReturnValue(false);
  mockGetLedgerEntries.mockResolvedValue({ entries: [], latestLedger: 100 });
});

describe("simulateTransaction", () => {
  it("returns success with footprint on a valid simulation", async () => {
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    const result = await simulateTransaction(DUMMY_XDR, "testnet");

    expect(result.success).toBe(true);
    expect(result.cost).toEqual({ cpuInsns: "1000", memBytes: "2000" });
    expect(result.footprint).toBeDefined();
    expect(result.rawFootprint).toBeDefined();
  });

  it("returns failure with error message on simulation error", async () => {
    const errorResponse = { error: "contract panic", raw: {} };
    isSimulationError.mockReturnValue(true);
    mockSimulateTransaction.mockResolvedValue(errorResponse);

    const result = await simulateTransaction(DUMMY_XDR, "testnet");

    expect(result.success).toBe(false);
    expect(result.error).toBe("contract panic");
    expect(result.raw).toBeDefined();
  });

  it("returns failure on restore response", async () => {
    isSimulationRestore.mockReturnValue(true);
    mockSimulateTransaction.mockResolvedValue({ raw: {} });

    const result = await simulateTransaction(DUMMY_XDR, "testnet");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/restoration/i);
  });

  it("returns failure when transactionData is missing", async () => {
    mockSimulateTransaction.mockResolvedValue({
      transactionData: undefined,
      cost: { cpuInsns: "0", memBytes: "0" },
    });

    const result = await simulateTransaction(DUMMY_XDR, "testnet");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/transactionData is missing/i);
  });

  it("propagates SDK throw as unhandled rejection", async () => {
    mockSimulateTransaction.mockRejectedValue(new Error("network timeout"));

    await expect(simulateTransaction(DUMMY_XDR, "testnet")).rejects.toThrow(
      "network timeout",
    );
  });

  it("returns empty contracts array when footprint is empty", async () => {
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    const result = await simulateTransaction(DUMMY_XDR, "testnet");

    expect(result.success).toBe(true);
    expect(result.contracts).toEqual([]);
  });

  it("passes ledgerSequence to simulateTransaction options when provided", async () => {
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    await simulateTransaction(DUMMY_XDR, "testnet", undefined, 999);

    const callArgs = mockSimulateTransaction.mock.calls[0];
    expect(callArgs[1]).toMatchObject({ ledger: 999 });
  });

  it("does not include ledger option when ledgerSequence is undefined", async () => {
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    await simulateTransaction(DUMMY_XDR, "testnet");

    const callArgs = mockSimulateTransaction.mock.calls[0];
    expect(callArgs[1]).not.toHaveProperty("ledger");
  });

  it("uses mainnet network config when network is mainnet", async () => {
    const { getRpcServer } = jest.requireMock("../../config/stellar");
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    await simulateTransaction(DUMMY_XDR, "mainnet");

    expect(getRpcServer).toHaveBeenCalledWith("mainnet");
  });
});
