<<<<<<< ours
<<<<<<< ours
import { simulateTransaction } from "../simulator";
import {
  SOROBAN_INVOKE_XDR,
  CLASSIC_PAYMENT_XDR,
  FEE_BUMP_XDR,
  INVALID_BASE64_XDR,
  INVALID_XDR_BYTES,
} from "../../tests/fixtures/xdr";
=======
import { simulateTransaction } from "@services/simulator";
>>>>>>> theirs
=======
import { simulateTransaction } from "@services/simulator";
>>>>>>> theirs

// ── Mocks ────────────────────────────────────────────────────────────────────

// jest.mock factories are hoisted before variable declarations, so all mock
// functions must be created inside the factory (not referenced from outside).

jest.mock("@config/stellar", () => ({
  getNetworkConfig: jest.fn().mockReturnValue({
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    secretKey: "",
  }),
  getRpcServer: jest.fn(),
}));

jest.mock("@stellar/stellar-sdk", () => ({
  TransactionBuilder: {
    fromXDR: jest.fn().mockReturnValue({}),
  },
  SorobanRpc: {
    Server: jest.fn(),
    Api: {
      isSimulationError: jest.fn(),
      isSimulationRestore: jest.fn(),
    },
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
}));

import * as StellarSdk from "@stellar/stellar-sdk";
import { getRpcServer } from "../../config/stellar";

// ── Helpers ──────────────────────────────────────────────────────────────────

// Use the shared fixture; kept as an alias so existing tests are unchanged.
const DUMMY_XDR = INVALID_XDR_BYTES;

// Stable mock server — getRpcServer always returns this same object.
const mockSimulateTransaction = jest.fn();
const mockGetLedgerEntries = jest.fn();
const mockServer = {
  simulateTransaction: mockSimulateTransaction,
  getLedgerEntries: mockGetLedgerEntries,
};

// Minimal XDR footprint builder helpers
const mockFootprint = {
  readOnly: jest.fn().mockReturnValue([]),
  readWrite: jest.fn().mockReturnValue([]),
};
const mockResources = jest
  .fn()
  .mockReturnValue({ footprint: () => mockFootprint });
const mockBuild = jest
  .fn()
  .mockReturnValue({
    resources: mockResources,
    auth: jest.fn().mockReturnValue([]),
  });
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
>>>>>>> theirs
const mockBuild = jest.fn().mockReturnValue({
  resources: mockResources,
  auth: jest.fn().mockReturnValue([]),
});
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
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
  .isSimulationError as unknown as jest.Mock;
const isSimulationRestore = StellarSdk.SorobanRpc.Api
  .isSimulationRestore as unknown as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────────────

const DUMMY_XDR = "AAAAAA==";

function makeSuccessResponse() {
  return {
    transactionData: mockTransactionData,
    cost: { cpuInsns: "1000", memBytes: "2000" },
    error: undefined,
  };
}

const isSimulationError = StellarSdk.SorobanRpc.Api.isSimulationError as unknown as jest.Mock;
const isSimulationRestore = StellarSdk.SorobanRpc.Api.isSimulationRestore as unknown as jest.Mock;

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (getRpcServer as jest.Mock).mockReturnValue(mockServer);
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
<<<<<<< ours
<<<<<<< ours
=======
    const { getRpcServer } = jest.requireMock("@config/stellar");
>>>>>>> theirs
=======
    const { getRpcServer } = jest.requireMock("@config/stellar");
>>>>>>> theirs
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    await simulateTransaction(DUMMY_XDR, "mainnet");

    expect(getRpcServer).toHaveBeenCalledWith("mainnet");
  });

  // ── Fixture-based tests ───────────────────────────────────────────────────

  it("accepts SOROBAN_INVOKE_XDR fixture and returns success", async () => {
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    const result = await simulateTransaction(SOROBAN_INVOKE_XDR, "testnet");

    expect(result.success).toBe(true);
  });

  it("accepts CLASSIC_PAYMENT_XDR fixture without throwing", async () => {
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    const result = await simulateTransaction(CLASSIC_PAYMENT_XDR, "testnet");

    expect(result.success).toBe(true);
  });

  it("accepts FEE_BUMP_XDR fixture without throwing", async () => {
    mockSimulateTransaction.mockResolvedValue(makeSuccessResponse());

    const result = await simulateTransaction(FEE_BUMP_XDR, "testnet");

    expect(result.success).toBe(true);
  });

  it("propagates error when INVALID_BASE64_XDR is passed to the SDK", async () => {
    const { TransactionBuilder } = jest.requireMock("@stellar/stellar-sdk");
    TransactionBuilder.fromXDR.mockImplementationOnce(() => {
      throw new Error("invalid base64");
    });

    await expect(
      simulateTransaction(INVALID_BASE64_XDR, "testnet"),
    ).rejects.toThrow("invalid base64");
  });
});
