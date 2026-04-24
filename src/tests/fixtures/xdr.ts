/**
 * XDR test fixtures for use across the test suite.
 *
 * All transaction XDRs are signed against the Stellar Testnet passphrase
 * ("Test SDF Network ; September 2015") and are structurally valid but
 * not submitted to any network.
 */

/**
 * A valid Soroban InvokeHostFunction transaction XDR.
 * Calls a no-op "hello" method on a placeholder contract.
 */
export const SOROBAN_INVOKE_XDR =
  "AAAAAgAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAGQAAAAAAAAAZwAAAAEAAAAAAAAAAAAAAABp6joKAAAAAAAAAAEAAAAAAAAAGAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFaGVsbG8AAAAAAAABAAAAAQAAAAAAAAAAAAAAAfK5hNUAAABAIbPVF4x6vSLx/J3T0SDhvTNtytA/BNO+qMJ74p/b3Y8xpBhR7xzy68FuEyffaF9fNXHEC+77WK+oOJpfon1tCg==";

/**
 * A valid classic payment transaction XDR (non-Soroban).
 * Sends 10 XLM on testnet. Useful for testing rejection of non-Soroban ops.
 */
export const CLASSIC_PAYMENT_XDR =
  "AAAAAgAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAGQAAAAAAAAAZQAAAAEAAAAAAAAAAAAAAABp6joKAAAAAAAAAAEAAAAAAAAAAQAAAACBuBB++TgKRxys9exytXimf/beipQQ56MDmtwaAqCClQAAAAAAAAAABfXhAAAAAAAAAAAB8rmE1QAAAEDLHQ6k5b2ZZDkoKTkUFcXdVlvVpjecSQDVINepYzOOLh9OCPM9CHnao2RfXNliTyv5J2VjoWsBxtdntLINUAUP";

/**
 * A valid fee-bump transaction XDR wrapping a classic payment.
 * Useful for testing that fee-bump envelopes are handled correctly.
 */
export const FEE_BUMP_XDR =
  "AAAABQAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAAAAAAGQAAAAAgAAAACnDQTKOBdaOH0ynf6k7SpkytahlUjNsWgm4WEB8rmE1QAAAGQAAAAAAAAAZgAAAAEAAAAAAAAAAAAAAABp6joKAAAAAAAAAAEAAAAAAAAAAQAAAACBuBB++TgKRxys9exytXimf/beipQQ56MDmtwaAqCClQAAAAAAAAAAAJiWgAAAAAAAAAAB8rmE1QAAAED+Bgzaei9jKakVUEpzuxCzO+Ps6rcBrrY7iBKfbnVzMEvWgrXfP1t0/5nry7+kqnRcwZlvOjhIkjaQ9s5Eu1cNAAAAAAAAAAHyuYTVAAAAQBwYHIR+QQkizIFaGmqycFTIcz6dbXv2X3IKGf7CpyCrqdudR/dhMrzrs4EVeFiZEvLPAoc7EUHT43PUy/LWNQ0=";

/**
 * An invalid base64 string — not valid XDR at all.
 * Useful for testing input validation and parse-error handling.
 */
export const INVALID_BASE64_XDR = "not-valid-base64!!!@@@";

/**
 * A structurally valid base64 string that does not decode to valid XDR.
 * Useful for testing XDR parse failures distinct from base64 decode failures.
 */
export const INVALID_XDR_BYTES = "AAAAAA==";
