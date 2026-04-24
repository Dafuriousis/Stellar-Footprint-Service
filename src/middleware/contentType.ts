import { Request, Response, NextFunction } from "express";

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
      error: "Content-Type must be application/json",
      received: contentType || "none",
    });
    return;
  }

  next();
}
