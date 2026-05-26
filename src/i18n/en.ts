export const en = {
  MISSING_XDR: "Missing required field: xdr",
  INVALID_NETWORK: "Invalid network. Use 'testnet', 'mainnet', or 'futurenet'",
  RPC_URL_NOT_CONFIGURED: "RPC URL not configured for network",
  LEDGER_ENTRY_RESTORATION_REQUIRED:
    "Transaction requires ledger entry restoration before simulation.",
  TRANSACTION_DATA_MISSING:
    "Simulation succeeded but transactionData is missing; cannot extract footprint.",
  UNEXPECTED_ERROR: "Unexpected error",
  CIRCUIT_OPEN: "Service temporarily unavailable. Please retry later.",
  REQUEST_TIMED_OUT: "Request timed out",
} as const;
