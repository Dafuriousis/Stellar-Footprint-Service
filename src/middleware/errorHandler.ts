import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

/**
 * Express error handling middleware
 * Catches all errors and returns consistent error response format
 */
export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
  } else {
    res.status(500).json({ error: "Internal server error" });
  }
}
