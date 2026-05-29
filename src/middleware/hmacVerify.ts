import crypto from "crypto";

import { Request, Response, NextFunction } from "express";

/**
 * #342 — HMAC-SHA256 signature verification middleware for inbound webhook routes.
 *
 * Expects the caller to send the signature in the `X-Webhook-Signature` header
 * as `sha256=<hex-digest>`. The shared secret is read from the
 * `WEBHOOK_VERIFY_SECRET` environment variable.
 *
 * Returns 401 if the header is missing, the secret is not configured, or the
 * signature does not match.
 */
export const WEBHOOK_SIGNATURE_HEADER = "x-webhook-signature";

export function hmacVerify(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.WEBHOOK_VERIFY_SECRET;

  if (!secret) {
    res.status(401).json({ error: "Webhook secret not configured" });
    return;
  }

  const signature = req.headers[WEBHOOK_SIGNATURE_HEADER] as string | undefined;

  if (!signature) {
    res.status(401).json({ error: "Missing webhook signature" });
    return;
  }

  const rawBody: Buffer =
    (req as Request & { rawBody?: Buffer }).rawBody ??
    Buffer.from(JSON.stringify(req.body));

  const expected = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expBuffer)
  ) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  next();
}
