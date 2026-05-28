/**
 * Closed-loop rate limiter for Instagram API calls.
 *
 * The previous (open-loop) implementation used fixed delays from constants
 * and never reacted to 429 / `feedback_required` responses. This version
 * adapts its current delay based on the outcome the caller reports:
 *
 *  - `onSuccess()`  → after `successesBeforeRecovery` consecutive wins,
 *                      ratchet `currentDelay` back toward `baseDelay` by
 *                      a factor of `recoveryRatio`.
 *  - `onRateLimit()` → reset success streak, then either jump to the
 *                      server-provided `Retry-After` (clamped to
 *                      `maxDelay`) or double the current delay.
 *
 * Every call to `wait()` applies multiplicative jitter so two clients
 * with identical inputs do not align their request bursts.
 */
export interface RateLimiterOptions {
  readonly baseDelay: number;
  readonly minDelay?: number;
  readonly maxDelay?: number;
  readonly jitterRatio?: number;
  readonly successesBeforeRecovery?: number;
  readonly recoveryRatio?: number;
  readonly random?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_DELAY = 300_000;
const DEFAULT_JITTER_RATIO = 0.2;
const DEFAULT_SUCCESSES_BEFORE_RECOVERY = 10;
const DEFAULT_RECOVERY_RATIO = 0.9;

export class AdaptiveRateLimiter {
  private readonly baseDelay: number;
  private readonly minDelay: number;
  private readonly maxDelay: number;
  private readonly jitterRatio: number;
  private readonly successesBeforeRecovery: number;
  private readonly recoveryRatio: number;
  private readonly random: () => number;
  private readonly sleepFn: (ms: number) => Promise<void>;

  private currentDelay: number;
  private consecutiveSuccesses = 0;

  constructor(options: RateLimiterOptions) {
    this.baseDelay = options.baseDelay;
    this.currentDelay = options.baseDelay;
    this.minDelay = options.minDelay ?? options.baseDelay;
    this.maxDelay = options.maxDelay ?? DEFAULT_MAX_DELAY;
    this.jitterRatio = options.jitterRatio ?? DEFAULT_JITTER_RATIO;
    this.successesBeforeRecovery = options.successesBeforeRecovery ?? DEFAULT_SUCCESSES_BEFORE_RECOVERY;
    this.recoveryRatio = options.recoveryRatio ?? DEFAULT_RECOVERY_RATIO;
    this.random = options.random ?? Math.random;
    this.sleepFn = options.sleep ?? defaultSleep;
  }

  /** Current base delay (without jitter). */
  getCurrentDelay(): number {
    return this.currentDelay;
  }

  /** Computes the next jittered delay without sleeping. Used by tests. */
  computeJitteredDelay(): number {
    const sign = this.random() * 2 - 1;
    const factor = 1 + sign * this.jitterRatio;
    return Math.round(this.currentDelay * factor);
  }

  /** Sleeps for the next jittered delay. */
  async wait(): Promise<void> {
    await this.sleepFn(this.computeJitteredDelay());
  }

  /**
   * Reports a successful API call. After enough wins, the limiter walks
   * the current delay back down toward the base.
   */
  onSuccess(): void {
    this.consecutiveSuccesses++;
    if (
      this.consecutiveSuccesses >= this.successesBeforeRecovery &&
      this.currentDelay > this.baseDelay
    ) {
      const next = Math.max(this.baseDelay, Math.round(this.currentDelay * this.recoveryRatio));
      this.currentDelay = Math.max(this.minDelay, next);
      this.consecutiveSuccesses = 0;
    }
  }

  /**
   * Reports a rate-limit response. Resets the recovery counter and
   * either jumps to the server-provided `Retry-After` (clamped to
   * `maxDelay`) or doubles the current delay.
   */
  onRateLimit(retryAfterMs?: number): void {
    this.consecutiveSuccesses = 0;
    if (retryAfterMs !== undefined && retryAfterMs > 0) {
      this.currentDelay = Math.min(this.maxDelay, Math.max(this.currentDelay, retryAfterMs));
    } else {
      this.currentDelay = Math.min(this.maxDelay, this.currentDelay * 2);
    }
  }

  /** Restore initial state. */
  reset(): void {
    this.currentDelay = this.baseDelay;
    this.consecutiveSuccesses = 0;
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
