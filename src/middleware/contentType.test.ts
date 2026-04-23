import { Request, Response } from "express";

import { contentTypeMiddleware } from "./contentType";

const createMockRequest = (method: string, contentType?: string): Request => {
  return {
    method,
    get: jest.fn().mockImplementation((header: string) => {
      if (header.toLowerCase() === "content-type") {
        return contentType;
      }
      return undefined;
    }),
  } as unknown as Request;
};

const createMockResponse = () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  return {
    status,
    json,
  } as unknown as Response;
};

describe("Content-Type middleware", () => {
  it("should reject POST requests without Content-Type", () => {
    const req = createMockRequest("POST", undefined);
    const res = createMockResponse();
    const next = jest.fn();

    contentTypeMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({
      error: "Content-Type must be application/json",
      received: "none",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject POST requests with non-JSON Content-Type", () => {
    const req = createMockRequest("POST", "text/plain");
    const res = createMockResponse();
    const next = jest.fn();

    contentTypeMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({
      error: "Content-Type must be application/json",
      received: "text/plain",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should allow POST requests with application/json Content-Type", () => {
    const req = createMockRequest("POST", "application/json");
    const res = createMockResponse();
    const next = jest.fn();

    contentTypeMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("should not validate GET requests", () => {
    const req = createMockRequest("GET", undefined);
    const res = createMockResponse();
    const next = jest.fn();

    contentTypeMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
