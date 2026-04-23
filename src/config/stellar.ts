import * as StellarSdk from "@stellar/stellar-sdk";

/** Supported Stellar networks */
export type Network = "mainnet" | "testnet";

/**
 * Configuration for a Stellar network
 * @property rpcUrl - The RPC endpoint URL for the network
 * @property networkPassphrase - The network passphrase for transaction signing
 * @property secretKey - The secret key for signing transactions (if needed)
 */
interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
  secretKey: string;
}

function createNetworkConfig(): Record<Network, NetworkConfig> {
  return {
    mainnet: {
      rpcUrl: process.env.MAINNET_RPC_URL || "",
      networkPassphrase: StellarSdk.Networks.PUBLIC,
      secretKey: process.env.MAINNET_SECRET_KEY || "",
    },
    testnet: {
      rpcUrl:
        process.env.TESTNET_RPC_URL || "https://soroban-testnet.stellar.org",
      networkPassphrase: StellarSdk.Networks.TESTNET,
      secretKey: process.env.TESTNET_SECRET_KEY || "",
    },
  };
}

/**
 * Get network configuration for the specified network
 * @param network - The network to configure ("testnet" or "mainnet")
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

const RPC_POOL_TTL_MS = parseInt(process.env.RPC_POOL_TTL_MS || "300000", 10);

interface PoolEntry {
  server: StellarSdk.SorobanRpc.Server;
  createdAt: number;
}

const pool = new Map<Network, PoolEntry>();

/**
 * Get or create an RPC server instance for the specified network
 * Uses connection pooling with TTL to reuse server instances
 * @param network - The network to connect to ("testnet" or "mainnet")
 * @returns Soroban RPC server instance
 */
export function getRpcServer(
  network: Network = "testnet",
): StellarSdk.SorobanRpc.Server {
  const now = Date.now();
  const entry = pool.get(network);

  if (entry && now - entry.createdAt < RPC_POOL_TTL_MS) {
    return entry.server;
  }

  const { rpcUrl } = getNetworkConfig(network);
  const server = new StellarSdk.SorobanRpc.Server(rpcUrl, { allowHttp: false });
  pool.set(network, { server, createdAt: now });
  return server;
}
