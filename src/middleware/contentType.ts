import { Request, Response, NextFunction } from "express";

/**
 * Middleware to validate Content-Type header on POST requests
 * Ensures all POST requests to JSON endpoints include Content-Type: application/json
 * Returns 415 Unsupported Media Type for invalid or missing Content-Type
 * This prevents CSRF and content-sniffing attacks
 */
export function contentTypeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Only validate POST requests
  if (req.method !== "POST") {
    return next();
  }

  // Get the Content-Type header
  const contentType = req.get("content-type");

  // Check if Content-Type is missing or doesn't match application/json
  if (!contentType || !contentType.includes("application/json")) {
    return res.status(415).json({
      error: "Content-Type must be application/json",
      received: contentType || "none",
    });
  }

  next();
}
