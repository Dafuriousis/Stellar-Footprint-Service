import { Request, Response, NextFunction } from "express";

/**
 * API key authentication middleware.
 * If API_KEYS env var is set (comma-separated), all /api/v1/* routes
 * require a valid Authorization: Bearer <key> header.
 * Routes matching /health are exempt.
 */
export function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const rawKeys = process.env.API_KEYS;

  // If no API_KEYS configured, auth is disabled — allow all requests
  if (!rawKeys || rawKeys.trim() === "") {
    return next();
  }

  // Health endpoints are exempt
  if (req.path.startsWith("/health")) {
    return next();
  }

  const validKeys = new Set(
    rawKeys
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: missing or invalid API key" });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "
  if (!validKeys.has(token)) {
    res.status(401).json({ error: "Unauthorized: missing or invalid API key" });
    return;
  }

  next();
}
