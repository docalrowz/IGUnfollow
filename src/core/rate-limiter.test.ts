import { describe, expect, it, vi } from 'vitest';
import { AdaptiveRateLimiter } from './rate-limiter';

describe('AdaptiveRateLimiter', () => {
  it('starts at baseDelay', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000 });
    expect(limiter.getCurrentDelay()).toBe(4000);
  });

  it('doubles current delay on rate limit without retryAfter', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000 });
    limiter.onRateLimit();
    expect(limiter.getCurrentDelay()).toBe(8000);
    limiter.onRateLimit();
    expect(limiter.getCurrentDelay()).toBe(16_000);
  });

  it('caps doubled delay at maxDelay (5min default)', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000, maxDelay: 300_000 });
    for (let i = 0; i < 20; i++) {
      limiter.onRateLimit();
    }
    expect(limiter.getCurrentDelay()).toBe(300_000);
  });

  it('jumps to retryAfter when larger than current delay', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000 });
    limiter.onRateLimit(60_000);
    expect(limiter.getCurrentDelay()).toBe(60_000);
  });

  it('clamps retryAfter to maxDelay', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000, maxDelay: 30_000 });
    limiter.onRateLimit(999_999);
    expect(limiter.getCurrentDelay()).toBe(30_000);
  });

  it('ignores retryAfter smaller than current delay', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000 });
    limiter.onRateLimit();
    expect(limiter.getCurrentDelay()).toBe(8000);
    limiter.onRateLimit(2000);
    expect(limiter.getCurrentDelay()).toBe(8000);
  });

  it('does not recover before successesBeforeRecovery wins', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000, successesBeforeRecovery: 10 });
    limiter.onRateLimit();
    expect(limiter.getCurrentDelay()).toBe(8000);
    for (let i = 0; i < 9; i++) {
      limiter.onSuccess();
    }
    expect(limiter.getCurrentDelay()).toBe(8000);
  });

  it('recovers toward baseDelay after threshold successes', () => {
    const limiter = new AdaptiveRateLimiter({
      baseDelay: 4000,
      successesBeforeRecovery: 10,
      recoveryRatio: 0.9,
    });
    limiter.onRateLimit();
    expect(limiter.getCurrentDelay()).toBe(8000);
    for (let i = 0; i < 10; i++) {
      limiter.onSuccess();
    }
    expect(limiter.getCurrentDelay()).toBe(7200);
  });

  it('never recovers below baseDelay', () => {
    const limiter = new AdaptiveRateLimiter({
      baseDelay: 4000,
      successesBeforeRecovery: 1,
      recoveryRatio: 0.1,
    });
    limiter.onRateLimit();
    for (let i = 0; i < 100; i++) {
      limiter.onSuccess();
    }
    expect(limiter.getCurrentDelay()).toBe(4000);
  });

  it('onRateLimit resets the success streak', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000, successesBeforeRecovery: 10 });
    limiter.onRateLimit();
    for (let i = 0; i < 9; i++) {
      limiter.onSuccess();
    }
    limiter.onRateLimit();
    expect(limiter.getCurrentDelay()).toBe(16_000);
  });

  it('reset returns to baseDelay', () => {
    const limiter = new AdaptiveRateLimiter({ baseDelay: 4000 });
    limiter.onRateLimit();
    limiter.onRateLimit();
    limiter.reset();
    expect(limiter.getCurrentDelay()).toBe(4000);
  });

  it('jitter stays within (1 - ratio) and (1 + ratio) bounds', () => {
    const samples: number[] = [];
    const limiter = new AdaptiveRateLimiter({
      baseDelay: 10_000,
      jitterRatio: 0.2,
      random: () => samples.shift() ?? 0.5,
    });
    samples.push(0);
    expect(limiter.computeJitteredDelay()).toBe(8000);
    samples.push(1);
    expect(limiter.computeJitteredDelay()).toBe(12_000);
    samples.push(0.5);
    expect(limiter.computeJitteredDelay()).toBe(10_000);
  });

  it('wait() calls the injected sleep with jittered delay', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const limiter = new AdaptiveRateLimiter({
      baseDelay: 5000,
      jitterRatio: 0,
      sleep,
    });
    await limiter.wait();
    expect(sleep).toHaveBeenCalledWith(5000);
  });
});
