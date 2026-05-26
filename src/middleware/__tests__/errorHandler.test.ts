import { Request, Response, NextFunction } from "express";

import { AppError } from "../../utils/AppError";
import { errorHandler } from "../errorHandler";

function makeRes() {
  const headers: Record<string, string> = {};
  return {
    set: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    _headers: headers,
  } as unknown as Response & { _headers: Record<string, string> };
}

function makeReq(acceptLanguage?: string): Request {
  return {
    headers: { "accept-language": acceptLanguage },
  } as unknown as Request;
}

const next: NextFunction = jest.fn();

describe("errorHandler", () => {
  it("returns 503 with Retry-After for circuit open errors", () => {
    const err = Object.assign(new Error("Circuit breaker is open"), {
      circuitOpen: true as const,
      retryAfter: 15,
    });
    const res = makeRes();
    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.set).toHaveBeenCalledWith("Retry-After", "15");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  it("translates circuit open message to Spanish", () => {
    const err = Object.assign(new Error("Circuit breaker is open"), {
      circuitOpen: true as const,
      retryAfter: 10,
    });
    const res = makeRes();
    errorHandler(err, makeReq("es"), res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error).toContain("temporalmente");
  });

  it("returns AppError status and message", () => {
    const err = new AppError("Missing required field: xdr", 400);
    const res = makeRes();
    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Missing required field: xdr" }),
    );
  });

  it("translates known AppError message to Spanish", () => {
    const err = new AppError("Missing required field: xdr", 400);
    const res = makeRes();
    errorHandler(err, makeReq("es"), res, next);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error).toBe("Campo requerido faltante: xdr");
  });

  it("returns 500 for generic errors", () => {
    const err = new Error("Something broke");
    const res = makeRes();
    errorHandler(err, makeReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
