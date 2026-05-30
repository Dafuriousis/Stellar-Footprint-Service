import { CircuitBreaker } from "../circuitBreaker";

jest.useFakeTimers();

describe("CircuitBreaker", () => {
  describe("initial state", () => {
    it("starts in closed state with zero failures", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      expect(cb.getState()).toEqual({ state: "closed", failures: 0 });
    });
  });

  describe("closed → open", () => {
    it("opens after reaching failureThreshold failures", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeMs: 1000,
      });
      const failing = () => Promise.reject(new Error("fail"));

      for (let i = 0; i < 3; i++) {
        await expect(cb.call(failing)).rejects.toThrow("fail");
      }

      expect(cb.getState().state).toBe("open");
    });

    it("stays closed below failureThreshold", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      const failing = () => Promise.reject(new Error("fail"));

      await expect(cb.call(failing)).rejects.toThrow("fail");
      await expect(cb.call(failing)).rejects.toThrow("fail");

      expect(cb.getState().state).toBe("closed");
      expect(cb.getState().failures).toBe(2);
    });

    it("rejects with circuitOpen error when open", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        recoveryTimeMs: 5000,
      });
      const failing = () => Promise.reject(new Error("fail"));

      await expect(cb.call(failing)).rejects.toThrow();
      await expect(cb.call(failing)).rejects.toThrow();

      const err = await cb.call(() => Promise.resolve("x")).catch((e) => e);
      expect(err.circuitOpen).toBe(true);
      expect(err.retryAfter).toBeGreaterThan(0);
    });
  });

  describe("open → half-open", () => {
    it("transitions to half-open after recoveryTimeMs elapses", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeMs: 1000,
      });

      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();
      expect(cb.getState().state).toBe("open");

      jest.advanceTimersByTime(1001);

      // Next call should be attempted (half-open probe)
      await cb.call(() => Promise.resolve("ok"));
      expect(cb.getState().state).toBe("closed");
    });

    it("remains open before recoveryTimeMs elapses", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeMs: 5000,
      });

      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();

      jest.advanceTimersByTime(4999);

      const err = await cb.call(() => Promise.resolve("x")).catch((e) => e);
      expect(err.circuitOpen).toBe(true);
    });
  });

  describe("half-open → closed", () => {
    it("closes on successful probe after recovery window", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeMs: 500,
      });

      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();
      jest.advanceTimersByTime(501);

      await cb.call(() => Promise.resolve("ok"));

      const state = cb.getState();
      expect(state.state).toBe("closed");
      expect(state.failures).toBe(0);
    });
  });

  describe("half-open → open", () => {
    it("re-opens when probe fails during half-open", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeMs: 500,
      });

      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();
      jest.advanceTimersByTime(501);

      await expect(
        cb.call(() => Promise.reject(new Error("probe fail"))),
      ).rejects.toThrow("probe fail");

      expect(cb.getState().state).toBe("open");
    });
  });

  describe("getState() retryAfter", () => {
    it("returns retryAfter in seconds when open", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeMs: 10_000,
      });

      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();

      const state = cb.getState();
      expect(state.state).toBe("open");
      expect(typeof state.retryAfter).toBe("number");
      expect(state.retryAfter).toBeGreaterThan(0);
      expect(state.retryAfter).toBeLessThanOrEqual(10);
    });

    it("retryAfter decreases as time passes", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeMs: 10_000,
      });

      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();

      const before = cb.getState().retryAfter!;
      jest.advanceTimersByTime(3000);
      const after = cb.getState().retryAfter!;

      expect(after).toBeLessThan(before);
    });

    it("retryAfter is 0 when recovery window has elapsed", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 1,
        recoveryTimeMs: 1000,
      });

      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();

      jest.advanceTimersByTime(1001);

      const state = cb.getState();
      expect(state.retryAfter).toBe(0);
    });

    it("does not include retryAfter when closed", () => {
      const cb = new CircuitBreaker();
      const state = cb.getState();
      expect(state.retryAfter).toBeUndefined();
    });
  });

  describe("success resets failures", () => {
    it("resets failure count after a successful call", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 5 });

      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();
      await expect(
        cb.call(() => Promise.reject(new Error("fail"))),
      ).rejects.toThrow();

      await cb.call(() => Promise.resolve("ok"));

      expect(cb.getState().failures).toBe(0);
      expect(cb.getState().state).toBe("closed");
    });
  });
});
