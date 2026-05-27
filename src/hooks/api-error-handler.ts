import { Dispatch, SetStateAction } from "react";
import {
  InstagramError,
  isCriticalError,
  isFatalError,
  isInstagramErrorException,
} from "../core/error-types";
import { AdaptiveRateLimiter } from "../core/rate-limiter";
import { CircuitBreaker, CircuitOpenError } from "../core/circuit-breaker";
import { isErrorRecoverable, State } from "../model/state";

export type ToastState = { readonly show: false } | { readonly show: true; readonly text: string };

/**
 * Shared error router for the scan and unfollow loops.
 *
 * Returns:
 *  - `"halt"` — caller MUST stop the loop. State has already been
 *    moved to the `error` variant.
 *  - `"retry"` — caller should re-attempt the same action. If the
 *    error was recoverable, the limiter has already waited.
 */
export async function handleApiError(
  e: unknown,
  limiter: AdaptiveRateLimiter,
  breaker: CircuitBreaker,
  previousStatus: 'scanning' | 'unfollowing',
  setState: Dispatch<SetStateAction<State>>,
  setToast: Dispatch<SetStateAction<ToastState>>,
): Promise<'halt' | 'retry'> {
  if (e instanceof CircuitOpenError) {
    setState({
      status: 'error',
      error: { kind: 'rate_limit' },
      recoverable: false,
      previousStatus,
    });
    setToast({ show: false });
    return 'halt';
  }
  if (!isInstagramErrorException(e)) {
    console.error(e);
    return 'retry';
  }
  const err: InstagramError = e.error;
  if (isCriticalError(err)) {
    breaker.recordCriticalError();
  }
  if (err.kind === 'rate_limit') {
    limiter.onRateLimit(err.retryAfter);
    setToast({
      show: true,
      text: `Rate limited. Backing off to ${Math.round(limiter.getCurrentDelay() / 1000)}s.`,
    });
  }
  if (isFatalError(err) || breaker.isOpen() || !isErrorRecoverable(err)) {
    setState({
      status: 'error',
      error: err,
      recoverable: isErrorRecoverable(err) && !breaker.isOpen(),
      previousStatus,
    });
    setToast({ show: false });
    return 'halt';
  }
  await limiter.wait();
  return 'retry';
}
