/**
 * Typed errors surfaced by the Instagram API layer.
 *
 * The discriminator (`kind`) is what callers branch on. `checkpoint` is
 * always a hard stop: Instagram is asking the user to verify the account,
 * so any further request would deepen the soft-ban. `rate_limit` is
 * recoverable via backoff. `csrf_expired` means we need a fresh token
 * from the cookie jar (Instagram rotated it mid-session). `network` is
 * transport-level (offline, DNS, timeout). `unknown` is the catch-all
 * for shapes we did not expect — preserves the raw payload for triage.
 */
export type InstagramError =
  | { readonly kind: 'rate_limit'; readonly retryAfter?: number }
  | { readonly kind: 'checkpoint'; readonly requiresUserAction: true }
  | { readonly kind: 'csrf_expired' }
  | { readonly kind: 'network'; readonly retryable: boolean }
  | { readonly kind: 'unknown'; readonly raw: unknown; readonly status: number };

/**
 * Throwable wrapper so `InstagramError` data can travel through Promise
 * rejection paths without losing its discriminated-union shape.
 */
export class InstagramErrorException extends Error {
  public readonly error: InstagramError;

  constructor(error: InstagramError) {
    super(`InstagramError[${error.kind}]`);
    this.name = 'InstagramErrorException';
    this.error = error;
  }
}

export function isInstagramErrorException(e: unknown): e is InstagramErrorException {
  return e instanceof InstagramErrorException;
}

/**
 * Errors that must halt the entire pipeline (no retry, no backoff).
 * `checkpoint` is the canonical case: continuing risks a hard ban.
 */
export function isFatalError(error: InstagramError): boolean {
  return error.kind === 'checkpoint';
}

/**
 * Errors that should trigger the adaptive rate limiter to back off.
 */
export function isRateLimitError(error: InstagramError): boolean {
  return error.kind === 'rate_limit';
}

/**
 * Errors that should be counted by the circuit breaker.
 * Per spec: checkpoint + rate_limit.
 */
export function isCriticalError(error: InstagramError): boolean {
  return error.kind === 'checkpoint' || error.kind === 'rate_limit';
}
