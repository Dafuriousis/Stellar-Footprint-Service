import * as StellarSdk from "@stellar/stellar-sdk";
import { env } from "./env";

/** Supported Stellar networks */
export type Network = "mainnet" | "testnet" | "futurenet";

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
      rpcUrl: env.MAINNET_RPC_URL,
      networkPassphrase: StellarSdk.Networks.PUBLIC,
      secretKey: env.MAINNET_SECRET_KEY,
    },
    testnet: {
      rpcUrl: env.TESTNET_RPC_URL,
      networkPassphrase: StellarSdk.Networks.TESTNET,
      secretKey: env.TESTNET_SECRET_KEY,
    },
    futurenet: {
      rpcUrl: env.FUTURENET_RPC_URL,
      networkPassphrase: StellarSdk.Networks.FUTURENET,
      secretKey: env.FUTURENET_SECRET_KEY,
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
  return createNetworkConfig()[network];
}

const RPC_POOL_TTL_MS = env.RPC_POOL_TTL_MS;

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
