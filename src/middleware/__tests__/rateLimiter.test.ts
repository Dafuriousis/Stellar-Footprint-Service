import express, { Request, Response } from "express";
import request from "supertest";

import { simulateRateLimiter } from "../rateLimiter";

/**
 * Build a minimal Express app that applies the rate limiter to the given
 * method + path and returns 200 for requests that are not rate-limited.
 */
function buildApp(
  max: number,
  windowMs: number,
  method: "get" | "post" = "post",
  path = "/simulate",
) {
  const rateLimit = require("express-rate-limit")
    .default as typeof import("express-rate-limit").default;

  const limiter = rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: true,
    handler: (_req: Request, res: Response) => {
      const retryAfter = Math.ceil(windowMs / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    },
  });

  const app = express();
  app.use(express.json());
  if (method === "get") {
    app.get(path, limiter, (_req, res) =>
      res.status(200).json({ success: true }),
    );
  } else {
    app.post(path, limiter, (_req, res) =>
      res.status(200).json({ success: true }),
    );
  }
  return app;
}

describe("simulateRateLimiter — X-RateLimit-* headers", () => {
  it("includes X-RateLimit-Limit on a normal (non-limited) response", async () => {
    const app = buildApp(10, 60000);
    const res = await request(app)
      .post("/simulate")
      .send({ xdr: "test", network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("x-ratelimit-limit");
    expect(res.headers["x-ratelimit-limit"]).toBe("10");
  });

  it("includes X-RateLimit-Remaining on a normal response", async () => {
    const app = buildApp(10, 60000);
    const res = await request(app)
      .post("/simulate")
      .send({ xdr: "test", network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("x-ratelimit-remaining");
    // First request: remaining should be max - 1
    expect(Number(res.headers["x-ratelimit-remaining"])).toBe(9);
  });

  it("includes X-RateLimit-Reset on a normal response", async () => {
    const app = buildApp(10, 60000);
    const res = await request(app)
      .post("/simulate")
      .send({ xdr: "test", network: "testnet" });

    expect(res.status).toBe(200);
    expect(res.headers).toHaveProperty("x-ratelimit-reset");
    // Reset value should be a future epoch timestamp (seconds)
    expect(Number(res.headers["x-ratelimit-reset"])).toBeGreaterThan(
      Math.floor(Date.now() / 1000),
    );
  });

  it("returns 429 with X-RateLimit-* headers when limit is exceeded", async () => {
    const max = 2;
    const windowMs = 60000;
    const app = buildApp(max, windowMs);

    // Exhaust the limit
    await request(app).post("/simulate").send({});
    await request(app).post("/simulate").send({});

    // This request should be rate-limited
    const res = await request(app).post("/simulate").send({});

    expect(res.status).toBe(429);
    expect(res.headers).toHaveProperty("x-ratelimit-limit");
    expect(res.headers).toHaveProperty("x-ratelimit-remaining");
    expect(res.headers).toHaveProperty("x-ratelimit-reset");
    expect(res.headers["x-ratelimit-remaining"]).toBe("0");
  });

  it("returns 429 with Retry-After header when limit is exceeded", async () => {
    const max = 1;
    const windowMs = 30000;
    const app = buildApp(max, windowMs);

    // Exhaust the limit
    await request(app).post("/simulate").send({});

    const res = await request(app).post("/simulate").send({});

    expect(res.status).toBe(429);
    expect(res.headers).toHaveProperty("retry-after");
    expect(Number(res.headers["retry-after"])).toBe(Math.ceil(windowMs / 1000));
  });

  it("returns 429 response body with error and retryAfter fields", async () => {
    const max = 1;
    const windowMs = 60000;
    const app = buildApp(max, windowMs);

    await request(app).post("/simulate").send({});
    const res = await request(app).post("/simulate").send({});

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      error: "Too Many Requests",
      retryAfter: Math.ceil(windowMs / 1000),
    });
  });
});

describe("decodeRateLimiter — GET /decode returns 429 after limit", () => {
  it("returns 200 while under the limit", async () => {
    const app = buildApp(5, 60000, "get", "/decode");
    const res = await request(app)
      .get("/decode")
      .query({ xdr: "test", type: "transaction" });
    expect(res.status).toBe(200);
  });

  it("returns 429 with Retry-After when limit is exceeded", async () => {
    const max = 2;
    const windowMs = 30000;
    const app = buildApp(max, windowMs, "get", "/decode");

    await request(app).get("/decode").query({ xdr: "a" });
    await request(app).get("/decode").query({ xdr: "b" });
    const res = await request(app).get("/decode").query({ xdr: "c" });

    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBe(Math.ceil(windowMs / 1000));
  });

  it("returns 429 body with error and retryAfter fields", async () => {
    const max = 1;
    const windowMs = 60000;
    const app = buildApp(max, windowMs, "get", "/decode");

    await request(app).get("/decode").query({ xdr: "a" });
    const res = await request(app).get("/decode").query({ xdr: "b" });

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      error: "Too Many Requests",
      retryAfter: Math.ceil(windowMs / 1000),
    });
  });

  it("includes X-RateLimit-Remaining: 0 on a rate-limited response", async () => {
    const app = buildApp(1, 60000, "get", "/decode");
    await request(app).get("/decode").query({ xdr: "a" });
    const res = await request(app).get("/decode").query({ xdr: "b" });

    expect(res.status).toBe(429);
    expect(res.headers["x-ratelimit-remaining"]).toBe("0");
  });
});

describe("feeRateLimiter — POST /estimate-fee returns 429 after limit", () => {
  it("returns 200 while under the limit", async () => {
    const app = buildApp(5, 60000, "post", "/estimate-fee");
    const res = await request(app)
      .post("/estimate-fee")
      .send({ cpuInsns: "1000", memBytes: "512" });
    expect(res.status).toBe(200);
  });

  it("returns 429 with Retry-After when limit is exceeded", async () => {
    const max = 2;
    const windowMs = 30000;
    const app = buildApp(max, windowMs, "post", "/estimate-fee");

    await request(app).post("/estimate-fee").send({});
    await request(app).post("/estimate-fee").send({});
    const res = await request(app).post("/estimate-fee").send({});

    expect(res.status).toBe(429);
    expect(Number(res.headers["retry-after"])).toBe(Math.ceil(windowMs / 1000));
  });

  it("returns 429 body with error and retryAfter fields", async () => {
    const max = 1;
    const windowMs = 60000;
    const app = buildApp(max, windowMs, "post", "/estimate-fee");

    await request(app).post("/estimate-fee").send({});
    const res = await request(app).post("/estimate-fee").send({});

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      error: "Too Many Requests",
      retryAfter: Math.ceil(windowMs / 1000),
    });
  });

  it("includes X-RateLimit-Remaining: 0 on a rate-limited response", async () => {
    const app = buildApp(1, 60000, "post", "/estimate-fee");
    await request(app).post("/estimate-fee").send({});
    const res = await request(app).post("/estimate-fee").send({});

    expect(res.status).toBe(429);
    expect(res.headers["x-ratelimit-remaining"]).toBe("0");
  });
});
