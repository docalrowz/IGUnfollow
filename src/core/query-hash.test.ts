import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractQueryHash,
  getFallbackQueryHash,
  getQueryHash,
  resetQueryHashCache,
} from './query-hash';

describe('extractQueryHash', () => {
  it('parses hash from a graphql URL', () => {
    const url =
      'https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={}';
    expect(extractQueryHash(url)).toBe('3dec7e2c57367ef3da3d987d89f9dbc8');
  });

  it('parses hash regardless of param position', () => {
    const url = 'https://example.test/foo?variables={}&query_hash=abcdef0123456789abcdef0123456789';
    expect(extractQueryHash(url)).toBe('abcdef0123456789abcdef0123456789');
  });

  it('returns null when the hash is missing', () => {
    expect(extractQueryHash('https://www.instagram.com/graphql/query/')).toBeNull();
  });

  it('returns null when the hash is malformed', () => {
    expect(extractQueryHash('https://x/?query_hash=tooshort')).toBeNull();
  });

  it('ignores hashes with non-hex characters', () => {
    expect(extractQueryHash('https://x/?query_hash=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz')).toBeNull();
  });
});

describe('getQueryHash', () => {
  beforeEach(() => {
    resetQueryHashCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetQueryHashCache();
  });

  it('returns the fallback when PerformanceObserver has no graphql entries', () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([]);
    expect(getQueryHash()).toBe(getFallbackQueryHash());
  });

  it('returns a detected hash when one appears in performance entries', () => {
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { name: 'https://www.instagram.com/static/bundle.js' } as PerformanceEntry,
      {
        name: 'https://www.instagram.com/graphql/query/?query_hash=deadbeefdeadbeefdeadbeefdeadbeef&variables={}',
      } as PerformanceEntry,
    ]);
    expect(getQueryHash()).toBe('deadbeefdeadbeefdeadbeefdeadbeef');
  });

  it('caches the result across calls', () => {
    const spy = vi
      .spyOn(performance, 'getEntriesByType')
      .mockReturnValue([
        {
          name: 'https://www.instagram.com/graphql/query/?query_hash=cafebabecafebabecafebabecafebabe&variables={}',
        } as PerformanceEntry,
      ]);
    expect(getQueryHash()).toBe('cafebabecafebabecafebabecafebabe');
    expect(getQueryHash()).toBe('cafebabecafebabecafebabecafebabe');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('resetQueryHashCache forces a re-read', () => {
    const spy = vi
      .spyOn(performance, 'getEntriesByType')
      .mockReturnValue([
        {
          name: 'https://www.instagram.com/graphql/query/?query_hash=cafebabecafebabecafebabecafebabe&variables={}',
        } as PerformanceEntry,
      ]);
    getQueryHash();
    resetQueryHashCache();
    getQueryHash();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
