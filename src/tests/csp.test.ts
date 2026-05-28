import request from "supertest";

import app from "../index";

describe("Content-Security-Policy header", () => {
  it("is set and contains restrictive directives appropriate for a JSON API", async () => {
    const res = await request(app).get("/metrics");

    expect(res.status).toBe(200);
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();

    // Assert presence of the critical directives we configured
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("connect-src 'self'");
  });
});
