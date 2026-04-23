export const NETWORKS = {
  MAINNET: "mainnet",
  TESTNET: "testnet",
} as const;

export const DEFAULT_NETWORK = NETWORKS.TESTNET;

export const RPC_URLS = {
  TESTNET: "https://soroban-testnet.stellar.org",
} as const;

export const CACHE_TTL = {
  NETWORK_STATUS_MS: 10000, // 10 seconds
  CONTRACT_EXISTENCE_MS: 30000, // 30 seconds
  RPC_POOL_MS: 300000, // 5 minutes
} as const;

export const ERROR_MESSAGES = {
  MISSING_XDR: "Missing required field: xdr",
  INVALID_NETWORK: "Invalid network. Use 'testnet' or 'mainnet'",
  RPC_URL_NOT_CONFIGURED: "RPC URL not configured for network",
  LEDGER_ENTRY_RESTORATION_REQUIRED:
    "Transaction requires ledger entry restoration before simulation.",
  TRANSACTION_DATA_MISSING:
    "Simulation succeeded but transactionData is missing; cannot extract footprint.",
  UNEXPECTED_ERROR: "Unexpected error",
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;
