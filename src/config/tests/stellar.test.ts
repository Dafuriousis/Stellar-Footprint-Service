jest.mock("@stellar/stellar-sdk", () => ({
  Networks: {
    TESTNET: "Test SDF Network ; September 2015",
    PUBLIC: "Public Global Stellar Network ; September 2015",
  },
  SorobanRpc: {
    Server: jest.fn().mockImplementation(() => ({ _mock: true })),
  },
}));

let getNetworkConfig: typeof import("../stellar").getNetworkConfig;
let getRpcServer: typeof import("../stellar").getRpcServer;

async function reimport() {
  jest.resetModules();
  const mod = await import("../stellar");
  getNetworkConfig = mod.getNetworkConfig;
  getRpcServer = mod.getRpcServer;
}

describe("getNetworkConfig", () => {
  const orig = process.env;
  beforeEach(async () => { process.env = { ...orig }; await reimport(); });
  afterEach(() => { process.env = orig; });

  it("returns testnet config with correct passphrase", () => {
    process.env.TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
    const cfg = getNetworkConfig("testnet");
    expect(cfg.networkPassphrase).toBe("Test SDF Network ; September 2015");
    expect(cfg.rpcUrl).toBe("https://soroban-testnet.stellar.org");
  });

  it("returns mainnet config with correct passphrase", () => {
    process.env.MAINNET_RPC_URL = "https://mainnet-rpc.stellar.org";
    const cfg = getNetworkConfig("mainnet");
    expect(cfg.networkPassphrase).toBe("Public Global Stellar Network ; September 2015");
    expect(cfg.rpcUrl).toBe("https://mainnet-rpc.stellar.org");
  });

  it("defaults to testnet when no argument given", () => {
    process.env.TESTNET_RPC_URL = "https://soroban-testnet.stellar.org";
    expect(getNetworkConfig().networkPassphrase).toBe("Test SDF Network ; September 2015");
  });

  it("throws when TESTNET_RPC_URL is missing", () => {
    delete process.env.TESTNET_RPC_URL;
    expect(() => getNetworkConfig("testnet")).toThrow(/RPC URL not configured for network: testnet/);
  });

  it("throws when MAINNET_RPC_URL is missing", () => {
    delete process.env.MAINNET_RPC_URL;
    expect(() => getNetworkConfig("mainnet")).toThrow(/RPC URL not configured for network: mainnet/);
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
  beforeEach(async () => {
    process.env = { ...orig, TESTNET_RPC_URL: "https://soroban-testnet.stellar.org", MAINNET_RPC_URL: "https://mainnet-rpc.stellar.org" };
    await reimport();
  });
  afterEach(() => { process.env = orig; });

  it("returns a server for testnet", () => { expect(getRpcServer("testnet")).toBeDefined(); });
  it("returns a server for mainnet", () => { expect(getRpcServer("mainnet")).toBeDefined(); });
  it("returns cached instance within TTL", () => { expect(getRpcServer("testnet")).toBe(getRpcServer("testnet")); });
  it("defaults to testnet", () => { expect(getRpcServer()).toBe(getRpcServer("testnet")); });
});
