import { Request, Response, NextFunction } from "express";
import { AppError } from "@utils/AppError";
import { AppError } from "../utils/AppError";
import { ResponseEnvelope } from "../types";

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
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message =
    err instanceof AppError ? err.message : "Internal server error";

  const response: ResponseEnvelope = {
    success: false,
    error: message,
  };

  res.status(statusCode).json(response);
}
