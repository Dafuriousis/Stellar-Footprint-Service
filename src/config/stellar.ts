import * as StellarSdk from "@stellar/stellar-sdk";

import { env } from "./env";

export type Network = "mainnet" | "testnet" | "futurenet";

export function isValidNetwork(value: unknown): value is Network {
  return value === "testnet" || value === "mainnet" || value === "futurenet";
}

interface NetworkConfig {
  rpcUrl: string;
  networkPassphrase: string;
}

function createNetworkConfig(): Record<Network, NetworkConfig> {
  return {
    mainnet: {
      rpcUrl: env.MAINNET_RPC_URL,
      networkPassphrase: StellarSdk.Networks.PUBLIC,
    },
    testnet: {
      rpcUrl: env.TESTNET_RPC_URL,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    },
    futurenet: {
      rpcUrl: env.FUTURENET_RPC_URL,
      networkPassphrase: StellarSdk.Networks.FUTURENET,
    },
  };
}

export function getNetworkConfig(network: Network = "testnet"): NetworkConfig {
  return createNetworkConfig()[network];
}

interface PoolEntry {
  server: StellarSdk.rpc.Server;
  createdAt: number;
}

const pool = new Map<Network, PoolEntry>();

export function getRpcServer(
  network: Network = "testnet",
): StellarSdk.rpc.Server {
  const rpcPoolTtlMs = parseInt(process.env.RPC_POOL_TTL_MS || "300000", 10);
  const now = Date.now();
  const entry = pool.get(network);

  if (entry && now - entry.createdAt < rpcPoolTtlMs) {
    return entry.server;
  }

  const { rpcUrl } = getNetworkConfig(network);
  const allowHttp = process.env.ALLOW_HTTP === "true";
  const server = new StellarSdk.rpc.Server(rpcUrl, { allowHttp });
  pool.set(network, { server, createdAt: now });
  return server;
}
