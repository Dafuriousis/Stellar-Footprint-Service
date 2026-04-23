type State = "closed" | "open" | "half-open";

interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeMs?: number;
}

export class CircuitBreaker {
  private state: State = "closed";
  private failures = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly recoveryTimeMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeMs = options.recoveryTimeMs ?? 30_000;
  }

  getState(): { state: State; failures: number; retryAfter?: number } {
    if (this.state === "open" && this.openedAt !== null) {
      const retryAfter = Math.ceil(
        (this.openedAt + this.recoveryTimeMs - Date.now()) / 1000,
      );
      return {
        state: "open",
        failures: this.failures,
        retryAfter: Math.max(0, retryAfter),
      };
    }
    return { state: this.state, failures: this.failures };
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - (this.openedAt ?? 0) >= this.recoveryTimeMs) {
        this.state = "half-open";
      } else {
        const retryAfter = Math.ceil(
          ((this.openedAt ?? 0) + this.recoveryTimeMs - Date.now()) / 1000,
        );
        const err = new Error("Circuit breaker is open") as Error & {
          circuitOpen: true;
          retryAfter: number;
        };
        err.circuitOpen = true;
        err.retryAfter = Math.max(1, retryAfter);
        throw err;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if ((err as { circuitOpen?: boolean }).circuitOpen) throw err;
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures += 1;
    if (this.state === "half-open" || this.failures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}

export const rpcCircuitBreaker = new CircuitBreaker({
  failureThreshold: parseInt(process.env.CB_FAILURE_THRESHOLD ?? "5", 10),
  recoveryTimeMs: parseInt(process.env.CB_RECOVERY_MS ?? "30000", 10),
});
