/**
 * Instagram's GraphQL `query_hash` for "followings of viewer" rotates
 * periodically. The previous implementation hard-coded one hash; every
 * rotation silently broke the tool until someone updated the constant.
 *
 * Strategy: read `query_hash` straight out of network requests Instagram
 * itself has already made on the current page (PerformanceObserver
 * "resource" entries). The browser records every GraphQL URL Instagram
 * fetches naturally — full of valid, current hashes. We pick the first
 * one we recognize and cache it for the rest of the session.
 *
 * Fallback: the historical hardcoded value, so first runs still work
 * before Instagram has had a chance to issue any graphql/query call.
 */
const FALLBACK_QUERY_HASH = '3dec7e2c57367ef3da3d987d89f9dbc8';

let cached: string | null = null;

/** Returns a query_hash, preferring a detected one over the fallback. */
export function getQueryHash(): string {
  if (cached !== null) {
    return cached;
  }
  const detected = detectFromPerformanceEntries();
  cached = detected ?? FALLBACK_QUERY_HASH;
  return cached;
}

/**
 * Polls PerformanceObserver entries up to `maxWaitMs` for a real
 * `query_hash` before settling on the hardcoded fallback. Use this
 * once per session before starting the scan loop: on a freshly-opened
 * Instagram tab, the browser may not have made any `graphql/query`
 * request yet, so the sync `getQueryHash()` returns the fallback. A
 * short poll catches the natural feed/profile fetches Instagram makes
 * during page settle.
 */
export async function awaitQueryHash(
  maxWaitMs = 5000,
  pollIntervalMs = 250,
  sleepFn: (ms: number) => Promise<void> = defaultSleep,
): Promise<string> {
  if (cached !== null) {
    return cached;
  }
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const detected = detectFromPerformanceEntries();
    if (detected !== null) {
      cached = detected;
      return cached;
    }
    await sleepFn(pollIntervalMs);
  }
  cached = FALLBACK_QUERY_HASH;
  return cached;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/** Test/debug helper — drops the in-memory cache. */
export function resetQueryHashCache(): void {
  cached = null;
}

/** Exposed for unit testing the URL parser in isolation. */
export function extractQueryHash(url: string): string | null {
  const match = url.match(/[?&]query_hash=([a-f0-9]{32})/i);
  return match === null ? null : match[1];
}

function detectFromPerformanceEntries(): string | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return null;
  }
  const entries = performance.getEntriesByType('resource');
  for (const entry of entries) {
    const hash = extractQueryHash(entry.name);
    if (hash !== null) {
      return hash;
    }
  }
  return null;
}

/** Exposed for tests + callers that want to assert detection vs fallback. */
export function getFallbackQueryHash(): string {
  return FALLBACK_QUERY_HASH;
}
