import type { Express } from "express";
import express from "express";
import helmet from "helmet";
import request from "supertest";

describe("security headers", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        },
      }),
    );
    app.use((_req, res, next) => {
      res.setHeader(
        "Permissions-Policy",
        "accelerometer=(),ambient-light-sensor=(),autoplay=(),battery=(),camera=(),cross-origin-isolated=(),display-capture=(),document-domain=(),encrypted-media=(),execution-while-not-rendered=(),execution-while-out-of-viewport=(),fullscreen=(),geolocation=(),gyroscope=(),keyboard-map=(),magnetometer=(),microphone=(),midi=(),navigation-override=(),payment=(),picture-in-picture=(),publickey-credentials-get=(),screen-wake-lock=(),sync-xhr=(),usb=(),web-share=(),xr-spatial-tracking=()",
      );
      next();
    });

    app.get("/test", (_req, res) => res.json({ ok: true }));
  });

  it("sets all expected security headers", async () => {
    const res = await request(app).get("/test");

    expect(res.status).toBe(200);

    // ── Helmet-provided headers ──────────────────────────────────────
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toContain(
      "default-src 'none'",
    );
    expect(res.headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["referrer-policy"]).toBeDefined();
    expect(res.headers["x-dns-prefetch-control"]).toMatch(/^on|off$/);
    expect(res.headers["x-download-options"]).toBe("noopen");
    expect(res.headers["x-xss-protection"]).toBe("0");
    expect(res.headers["x-permitted-cross-domain-policies"]).toBe("none");
    expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin");
    expect(res.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(res.headers["origin-agent-cluster"]).toBe("?1");

    // ── Custom-managed headers ──────────────────────────────────────
    // Added via inline middleware — every browser feature disabled
    expect(res.headers["permissions-policy"]).toBeDefined();
    expect(res.headers["permissions-policy"]).not.toBe("");
  });
});
