import { withRetry, isTransientError } from "../retry";

// Mock the logger to suppress output during tests
jest.mock("../logger", () => ({
  logger: { warn: jest.fn(), debug: jest.fn() },
}));

// Speed up tests by mocking setTimeout
jest.useFakeTimers();

describe("isTransientError", () => {
  it("returns true for ECONNRESET", () => {
    const err = Object.assign(new Error("read ECONNRESET"), {
      code: "ECONNRESET",
    });
    expect(isTransientError(err)).toBe(true);
  });

  it("returns true for ETIMEDOUT", () => {
    const err = Object.assign(new Error("connect ETIMEDOUT"), {
      code: "ETIMEDOUT",
    });
    expect(isTransientError(err)).toBe(true);
  });

  it("returns true for network timeout message", () => {
    expect(isTransientError(new Error("network timeout occurred"))).toBe(true);
  });

  it("returns false for simulation errors", () => {
    expect(
      isTransientError(new Error("simulation error: contract failed")),
    ).toBe(false);
  });

  it("returns false for invalid XDR", () => {
    expect(isTransientError(new Error("invalid xdr provided"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isTransientError("string error")).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns result immediately on success", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const promise = withRetry(fn, "test", 3);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient error and succeeds on third attempt", async () => {
    const transientErr = Object.assign(new Error("read ECONNRESET"), {
      code: "ECONNRESET",
    });
    const fn = jest
      .fn()
      .mockRejectedValueOnce(transientErr)
      .mockRejectedValueOnce(transientErr)
      .mockResolvedValue("success");

    const promise = withRetry(fn, "test", 3);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry on simulation errors", async () => {
    const simErr = new Error("simulation error: wasm trap");
    const fn = jest.fn().mockRejectedValue(simErr);

    await expect(withRetry(fn, "test", 3)).rejects.toThrow(
      "simulation error: wasm trap",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("exhausts retries and throws last error", async () => {
    const transientErr = Object.assign(new Error("connect ETIMEDOUT"), {
      code: "ETIMEDOUT",
    });
    const fn = jest.fn().mockRejectedValue(transientErr);

    // Attach rejection handler immediately to avoid PromiseRejectionHandledWarning,
    // then advance fake timers concurrently so the retry loop can complete.
    const [result] = await Promise.all([
      expect(withRetry(fn, "test", 3)).rejects.toThrow("connect ETIMEDOUT"),
      jest.runAllTimersAsync(),
    ]);
    void result;
    expect(fn).toHaveBeenCalledTimes(4); // initial + 3 retries
  });
});
