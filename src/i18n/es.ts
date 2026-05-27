export const es = {
  MISSING_XDR: "Campo requerido faltante: xdr",
  INVALID_NETWORK: "Red inválida. Use 'testnet', 'mainnet' o 'futurenet'",
  RPC_URL_NOT_CONFIGURED: "URL de RPC no configurada para la red",
  LEDGER_ENTRY_RESTORATION_REQUIRED:
    "La transacción requiere restauración de entradas del ledger antes de la simulación.",
  TRANSACTION_DATA_MISSING:
    "La simulación fue exitosa pero falta transactionData; no se puede extraer el footprint.",
  UNEXPECTED_ERROR: "Error inesperado",
  CIRCUIT_OPEN:
    "Servicio temporalmente no disponible. Por favor, reintente más tarde.",
  REQUEST_TIMED_OUT: "La solicitud ha expirado",
} as const;
