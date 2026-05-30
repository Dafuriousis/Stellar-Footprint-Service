import { Request, Response, NextFunction } from "express";

import { ErrorCode } from "../constants";

export function contentTypeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method !== "POST") {
    next();
    return;
  }

  const contentType = req.get("content-type");

  if (!contentType || !contentType.includes("application/json")) {
    res.status(415).json({
      success: false,
      error: "Content-Type must be application/json",
      code: ErrorCode.CONTENT_TYPE_INVALID,
      received: contentType || "none",
    });
    return;
  }

  next();
}
