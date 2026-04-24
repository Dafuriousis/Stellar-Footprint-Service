import { isValidNetwork } from "../stellar";

const mockServer = { _mock: true };

async function reimport() {
  jest.resetModules();
  jest.doMock("@stellar/stellar-sdk", () => ({
    Networks: {
      TESTNET: "Test SDF Network ; September 2015",
      PUBLIC: "Public Global Stellar Network ; September 2015",
      FUTURENET: "Test SDF Future Network ; October 2022",
    },
    rpc: {
      Server: jest.fn().mockImplementation(() => mockServer),
    },
  }));
  const mod = await import("../stellar");
  return mod;
}

describe("getNetworkConfig", () => {
  const orig = process.env;
  let getNetworkConfig: typeof import("../stellar").getNetworkConfig;

  beforeEach(async () => {
    process.env = { ...orig };
    const mod = await reimport();
    getNetworkConfig = mod.getNetworkConfig;
  });
  afterEach(() => {
    process.env = orig;
  });

  it("returns testnet config with correct passphrase", () => {
    process.env.TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
    const cfg = getNetworkConfig("testnet");
    expect(cfg.networkPassphrase).toBe("Test SDF Network ; September 2015");
    expect(cfg.rpcUrl).toBe("https://soroban-testnet.stellar.org");
  });

  it("returns mainnet config with correct passphrase", () => {
    process.env.MAINNET_RPC_URL = "https://mainnet-rpc.stellar.org";
    const cfg = getNetworkConfig("mainnet");
    expect(cfg.networkPassphrase).toBe(
      "Public Global Stellar Network ; September 2015",
    );
    expect(cfg.rpcUrl).toBe("https://mainnet-rpc.stellar.org");
  });

  it("defaults to testnet when no argument given", () => {
    process.env.TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
    expect(getNetworkConfig().networkPassphrase).toBe(
      "Test SDF Network ; September 2015",
    );
  });

  it("throws when TESTNET_RPC_URL is missing", () => {
    delete process.env.TESTNET_RPC_URL;
    expect(() => getNetworkConfig("testnet")).toThrow(
      /RPC URL not configured for network: testnet/,
    );
  });

  it("throws when MAINNET_RPC_URL is missing", () => {
    delete process.env.MAINNET_RPC_URL;
    expect(() => getNetworkConfig("mainnet")).toThrow(
      /RPC URL not configured for network: mainnet/,
    );
  });

  it("returns secretKey from env", () => {
    process.env.TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
    process.env.TESTNET_SECRET_KEY = "STEST";
    expect(getNetworkConfig("testnet").secretKey).toBe("STEST");
  });

  it("secretKey defaults to empty string when not set", () => {
    process.env.TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
    delete process.env.TESTNET_SECRET_KEY;
    expect(getNetworkConfig("testnet").secretKey).toBe("");
  });
});

describe("getRpcServer", () => {
  const orig = process.env;
  let getRpcServer: typeof import("../stellar").getRpcServer;

  beforeEach(async () => {
    process.env = {
      ...orig,
      TESTNET_RPC_URL: "https://soroban-testnet.stellar.org",
      MAINNET_RPC_URL: "https://mainnet-rpc.stellar.org",
    };
    const mod = await reimport();
    getRpcServer = mod.getRpcServer;
  });
  afterEach(() => {
    process.env = orig;
  });

  it("returns a server for testnet", () => {
    expect(getRpcServer("testnet")).toBeDefined();
  });
  it("returns a server for mainnet", () => {
    expect(getRpcServer("mainnet")).toBeDefined();
  });
  it("returns cached instance within TTL", () => {
    expect(getRpcServer("testnet")).toBe(getRpcServer("testnet"));
  });
  it("defaults to testnet", () => {
    expect(getRpcServer()).toBe(getRpcServer("testnet"));
  });
});

describe("isValidNetwork", () => {
  it("returns true for 'testnet'", () => {
    expect(isValidNetwork("testnet")).toBe(true);
  });

  it("returns true for 'mainnet'", () => {
    expect(isValidNetwork("mainnet")).toBe(true);
  });

  it("returns false for an unknown string", () => {
    expect(isValidNetwork("devnet")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidNetwork("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidNetwork(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isValidNetwork(undefined)).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isValidNetwork(42)).toBe(false);
  });
});
