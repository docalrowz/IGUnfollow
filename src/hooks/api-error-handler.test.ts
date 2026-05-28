import { describe, expect, it, vi } from 'vitest';
import { handleApiError, ToastState } from './api-error-handler';
import { AdaptiveRateLimiter } from '../core/rate-limiter';
import { CircuitBreaker, CircuitOpenError } from '../core/circuit-breaker';
import { InstagramErrorException } from '../core/error-types';
import { State } from '../model/state';

function setup() {
  const limiter = new AdaptiveRateLimiter({
    baseDelay: 1_000,
    maxDelay: 60_000,
    jitterRatio: 0,
    random: () => 0.5,
    sleep: () => Promise.resolve(),
  });
  const breaker = new CircuitBreaker({ threshold: 3, windowSize: 10 });
  const setState = vi.fn();
  const setToast = vi.fn();
  return { limiter, breaker, setState, setToast };
}

describe('handleApiError', () => {
  it('returns retry for unknown (non-Instagram) errors and does not touch state', async () => {
    const { limiter, breaker, setState, setToast } = setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await handleApiError(
      new Error('boom'),
      limiter,
      breaker,
      'scanning',
      setState as unknown as React.Dispatch<React.SetStateAction<State>>,
      setToast as unknown as React.Dispatch<React.SetStateAction<ToastState>>,
    );

    expect(result).toBe('retry');
    expect(setState).not.toHaveBeenCalled();
    expect(setToast).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('halts and surfaces error state when the circuit breaker is already open', async () => {
    const { limiter, breaker, setState, setToast } = setup();

    const result = await handleApiError(
      new CircuitOpenError(),
      limiter,
      breaker,
      'unfollowing',
      setState as unknown as React.Dispatch<React.SetStateAction<State>>,
      setToast as unknown as React.Dispatch<React.SetStateAction<ToastState>>,
    );

    expect(result).toBe('halt');
    expect(setState).toHaveBeenCalledWith({
      status: 'error',
      error: { kind: 'rate_limit' },
      recoverable: false,
      previousStatus: 'unfollowing',
    });
  });

  it('backs off and retries on a recoverable rate_limit error', async () => {
    const { limiter, breaker, setState, setToast } = setup();
    const exception = new InstagramErrorException({ kind: 'rate_limit' });

    const result = await handleApiError(
      exception,
      limiter,
      breaker,
      'scanning',
      setState as unknown as React.Dispatch<React.SetStateAction<State>>,
      setToast as unknown as React.Dispatch<React.SetStateAction<ToastState>>,
    );

    expect(result).toBe('retry');
    expect(setToast).toHaveBeenCalledTimes(1);
    expect(setState).not.toHaveBeenCalled();
    expect(limiter.getCurrentDelay()).toBeGreaterThan(1_000);
    expect(breaker.getCriticalCount()).toBe(1);
  });

  it('halts on a checkpoint (fatal) error and marks it non-recoverable', async () => {
    const { limiter, breaker, setState, setToast } = setup();
    const exception = new InstagramErrorException({
      kind: 'checkpoint',
      requiresUserAction: true,
    });

    const result = await handleApiError(
      exception,
      limiter,
      breaker,
      'unfollowing',
      setState as unknown as React.Dispatch<React.SetStateAction<State>>,
      setToast as unknown as React.Dispatch<React.SetStateAction<ToastState>>,
    );

    expect(result).toBe('halt');
    expect(setState).toHaveBeenCalledWith({
      status: 'error',
      error: { kind: 'checkpoint', requiresUserAction: true },
      recoverable: false,
      previousStatus: 'unfollowing',
    });
    expect(setToast).toHaveBeenLastCalledWith({ show: false });
  });

  it('halts once the breaker trips after three critical rate-limit hits', async () => {
    const { limiter, breaker, setState, setToast } = setup();

    for (let i = 0; i < 2; i++) {
      await handleApiError(
        new InstagramErrorException({ kind: 'rate_limit' }),
        limiter,
        breaker,
        'scanning',
        setState as unknown as React.Dispatch<React.SetStateAction<State>>,
        setToast as unknown as React.Dispatch<React.SetStateAction<ToastState>>,
      );
    }
    expect(setState).not.toHaveBeenCalled();

    const finalResult = await handleApiError(
      new InstagramErrorException({ kind: 'rate_limit' }),
      limiter,
      breaker,
      'scanning',
      setState as unknown as React.Dispatch<React.SetStateAction<State>>,
      setToast as unknown as React.Dispatch<React.SetStateAction<ToastState>>,
    );

    expect(finalResult).toBe('halt');
    expect(breaker.isOpen()).toBe(true);
    expect(setState).toHaveBeenCalledTimes(1);
    const [arg] = setState.mock.calls[0];
    expect(arg).toMatchObject({ status: 'error', recoverable: false, previousStatus: 'scanning' });
  });

  it('halts on csrf_expired but marks it recoverable so the user can retry', async () => {
    const { limiter, breaker, setState, setToast } = setup();

    const result = await handleApiError(
      new InstagramErrorException({ kind: 'csrf_expired' }),
      limiter,
      breaker,
      'scanning',
      setState as unknown as React.Dispatch<React.SetStateAction<State>>,
      setToast as unknown as React.Dispatch<React.SetStateAction<ToastState>>,
    );

    expect(result).toBe('retry');
    expect(setState).not.toHaveBeenCalled();
  });

  it('halts on unknown errors with the raw payload preserved', async () => {
    const { limiter, breaker, setState, setToast } = setup();
    const exception = new InstagramErrorException({
      kind: 'unknown',
      raw: { whatever: 1 },
      status: 502,
    });

    const result = await handleApiError(
      exception,
      limiter,
      breaker,
      'scanning',
      setState as unknown as React.Dispatch<React.SetStateAction<State>>,
      setToast as unknown as React.Dispatch<React.SetStateAction<ToastState>>,
    );

    expect(result).toBe('halt');
    expect(setState).toHaveBeenCalledTimes(1);
    const [arg] = setState.mock.calls[0];
    expect(arg).toMatchObject({
      status: 'error',
      error: { kind: 'unknown', status: 502 },
    });
  });
});
