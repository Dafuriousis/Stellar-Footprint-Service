import * as StellarSdk from "@stellar/stellar-sdk";

/** Supported Stellar networks */
export type Network = "mainnet" | "testnet" | "futurenet";

/**
 * Type guard that checks whether a value is a valid Network.
 * Returns true only for "testnet" and "mainnet".
 * @param value - The value to check
 */
export function isValidNetwork(value: unknown): value is Network {
  return value === "testnet" || value === "mainnet";
}

/**
 * Configuration for a Stellar network
 * @property rpcUrl - The RPC endpoint URL for the network
 * @property networkPassphrase - The network passphrase for transaction signing
 * Note: Secret keys are intentionally excluded — signing is the caller's responsibility.
 */
interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
}

function createNetworkConfig(): Record<Network, NetworkConfig> {
  return {
    mainnet: {
      rpcUrl: process.env.MAINNET_RPC_URL || "",
      networkPassphrase: StellarSdk.Networks.PUBLIC,
    },
    testnet: {
      rpcUrl:
        process.env.TESTNET_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: StellarSdk.Networks.TESTNET,
    },
    futurenet: {
      rpcUrl:
        process.env.FUTURENET_RPC_URL || "https://rpc-futurenet.stellar.org:443",
      networkPassphrase: StellarSdk.Networks.FUTURENET,
      secretKey: process.env.FUTURENET_SECRET_KEY || "",
    },
    futurenet: {
      rpcUrl:
        process.env.FUTURENET_RPC_URL || "https://rpc-futurenet.stellar.org:443",
      networkPassphrase: StellarSdk.Networks.FUTURENET,
      secretKey: process.env.FUTURENET_SECRET_KEY || "",
    },
  };
}

/**
 * Get network configuration for the specified network
 * @param network - The network to configure ("testnet", "mainnet", or "futurenet")
 * @returns Network configuration object
 * @throws Error if RPC URL is not configured for the network
 */
export function getNetworkConfig(network: Network = "testnet"): NetworkConfig {
  const config = createNetworkConfig()[network];
  if (!config.rpcUrl) {
    throw new Error(`RPC URL not configured for network: ${network}`);
  }
  return config;
}

interface PoolEntry {
  server: StellarSdk.SorobanRpc.Server;
  createdAt: number;
}

const pool = new Map<Network, PoolEntry>();

/**
 * Get or create an RPC server instance for the specified network
 * Uses connection pooling with TTL to reuse server instances
 * @param network - The network to connect to ("testnet", "mainnet", or "futurenet")
 * @returns Soroban RPC server instance
 */
export function getRpcServer(
  network: Network = "testnet",
): StellarSdk.SorobanRpc.Server {
  // Read at call time so dotenv.config() in index.ts runs first
  const rpcPoolTtlMs = parseInt(process.env.RPC_POOL_TTL_MS || "300000", 10);
  const now = Date.now();
  const entry = pool.get(network);

  if (entry && now - entry.createdAt < rpcPoolTtlMs) {
    return entry.server;
  }

  const { rpcUrl } = getNetworkConfig(network);
  const allowHttp = process.env.ALLOW_HTTP === "true";
  const server = new StellarSdk.SorobanRpc.Server(rpcUrl, { allowHttp });
  pool.set(network, { server, createdAt: now });
  return server;
}
