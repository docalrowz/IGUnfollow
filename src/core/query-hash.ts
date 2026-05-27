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
