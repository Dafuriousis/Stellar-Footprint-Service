export const NETWORKS = {
  MAINNET: "mainnet",
  TESTNET: "testnet",
  FUTURENET: "futurenet",
} as const;

export const DEFAULT_NETWORK = NETWORKS.TESTNET;

export const RPC_URLS = {
  TESTNET: "https://soroban-testnet.stellar.org",
} as const;

export const CACHE_TTL = {
  NETWORK_STATUS_MS: 10000, // 10 seconds
  CONTRACT_EXISTENCE_MS: 30000, // 30 seconds
  RPC_POOL_MS: 300000, // 5 minutes
  SIMULATION_MS: 60000, // 1 minute (for simulation result caching)
<<<<<<< ours
=======
} as const;

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export const CACHE_CONFIG = {
  MAX_SIZE: 500, // Max entries in LRU in-memory cache
>>>>>>> theirs
} as const;

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export const CACHE_CONFIG = {
  MAX_SIZE: 500, // Max entries in LRU in-memory cache
} as const;
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
/** Simulation result LRU cache — configurable via env vars */
export const SIMULATION_CACHE_TTL_MS =
  (parseInt(process.env.CACHE_TTL_SECONDS ?? "60", 10) || 60) * 1000;
export const SIMULATION_CACHE_MAX_SIZE =
  parseInt(process.env.CACHE_MAX_SIZE ?? "500", 10) || 500;
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs

export const BATCH_MAX_SIZE = 10;

export const ERROR_MESSAGES = {
  MISSING_XDR: "Missing required field: xdr",
  INVALID_NETWORK: "Invalid network. Use 'testnet', 'mainnet', or 'futurenet'",
  RPC_URL_NOT_CONFIGURED: "RPC URL not configured for network",
  LEDGER_ENTRY_RESTORATION_REQUIRED:
    "Transaction requires ledger entry restoration before simulation.",
  TRANSACTION_DATA_MISSING:
    "Simulation succeeded but transactionData is missing; cannot extract footprint.",
  UNEXPECTED_ERROR: "Unexpected error",
} as const;

export const HTTP_STATUS = {
  OK: 200,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
} as const;
