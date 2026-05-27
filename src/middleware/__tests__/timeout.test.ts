import { Request, Response, NextFunction } from "express";

import { timeoutMiddleware } from "../timeout";

function makeReqRes() {
  const listeners: Record<string, (() => void)[]> = {};
  const req = {
    on(event: string, cb: () => void) {
      listeners[event] = listeners[event] ?? [];
      listeners[event].push(cb);
    },
    emit(event: string) {
      listeners[event]?.forEach((cb) => cb());
    },
  } as unknown as Request;

  const resListeners: Record<string, (() => void)[]> = {};
  const res = {
    locals: {} as Record<string, unknown>,
    headersSent: false,
    on(event: string, cb: () => void) {
      resListeners[event] = resListeners[event] ?? [];
      resListeners[event].push(cb);
    },
    emit(event: string) {
      resListeners[event]?.forEach((cb) => cb());
    },
    set: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  return {
    req,
    res,
    reqEmit: (e: string) =>
      (req as unknown as { emit(e: string): void }).emit(e),
    resEmit: (e: string) =>
      (res as unknown as { emit(e: string): void }).emit(e),
  };
}

describe("timeoutMiddleware", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("sets res.locals.abortSignal", () => {
    const { req, res } = makeReqRes();
    const next: NextFunction = jest.fn();
    timeoutMiddleware(req, res, next);
    expect(res.locals.abortSignal).toBeInstanceOf(AbortSignal);
    expect(next).toHaveBeenCalled();
  });

  it("aborts signal when client disconnects (req close)", () => {
    const { req, res, reqEmit } = makeReqRes();
    const next: NextFunction = jest.fn();
    timeoutMiddleware(req, res, next);

    const signal = res.locals.abortSignal as AbortSignal;
    expect(signal.aborted).toBe(false);

    reqEmit("close");
    expect(signal.aborted).toBe(true);
  });

  it("aborts signal on server-side timeout", () => {
    const { req, res } = makeReqRes();
    const next: NextFunction = jest.fn();
    timeoutMiddleware(req, res, next);

    const signal = res.locals.abortSignal as AbortSignal;
    jest.runAllTimers();
    expect(signal.aborted).toBe(true);
  });
});
