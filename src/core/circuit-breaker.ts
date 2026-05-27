/**
 * Sliding-window circuit breaker for the Instagram API pipeline.
 *
 * Counts critical errors (`checkpoint`, `rate_limit`) over the last
 * `windowSize` outcomes. Once `threshold` critical events accumulate,
 * the breaker opens and every subsequent call to `ensureClosed()`
 * throws — stopping the scan / unfollow loop before it digs the user
 * deeper into a soft ban. The breaker does not auto-close; the caller
 * must explicitly `reset()` after the user has resolved the situation
 * (verified the account, waited out the cooldown, etc.).
 */
export interface CircuitBreakerOptions {
  readonly threshold: number;
  readonly windowSize: number;
}

const DEFAULTS: CircuitBreakerOptions = {
  threshold: 3,
  windowSize: 10,
};

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit breaker is open');
    this.name = 'CircuitOpenError';
  }
}

export class CircuitBreaker {
  private readonly threshold: number;
  private readonly windowSize: number;
  private readonly window: boolean[] = [];
  private opened = false;

  constructor(options: CircuitBreakerOptions = DEFAULTS) {
    this.threshold = options.threshold;
    this.windowSize = options.windowSize;
  }

  recordSuccess(): void {
    this.push(false);
  }

  recordCriticalError(): void {
    this.push(true);
    if (this.criticalCount() >= this.threshold) {
      this.opened = true;
    }
  }

  isOpen(): boolean {
    return this.opened;
  }

  /**
   * Throws `CircuitOpenError` if the breaker has tripped. Call this
   * before every outbound request inside the scan / unfollow loops.
   */
  ensureClosed(): void {
    if (this.opened) {
      throw new CircuitOpenError();
    }
  }

  reset(): void {
    this.window.length = 0;
    this.opened = false;
  }

  /** Test / debug helper — exposes the count in the current window. */
  getCriticalCount(): number {
    return this.criticalCount();
  }

  private push(critical: boolean): void {
    this.window.push(critical);
    if (this.window.length > this.windowSize) {
      this.window.shift();
    }
  }

  private criticalCount(): number {
    let count = 0;
    for (const entry of this.window) {
      if (entry) {
        count++;
      }
    }
    return count;
  }
}
