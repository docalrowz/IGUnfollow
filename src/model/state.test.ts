import { describe, expect, it } from 'vitest';
import { isErrorRecoverable } from './state';
import { InstagramError } from '../core/error-types';

describe('isErrorRecoverable', () => {
  const cases: Array<{ name: string; error: InstagramError; expected: boolean }> = [
    { name: 'rate_limit', error: { kind: 'rate_limit' }, expected: true },
    { name: 'network', error: { kind: 'network', retryable: true }, expected: true },
    { name: 'csrf_expired', error: { kind: 'csrf_expired' }, expected: true },
    { name: 'checkpoint', error: { kind: 'checkpoint', requiresUserAction: true }, expected: false },
    { name: 'unknown', error: { kind: 'unknown', raw: 'whatever', status: 500 }, expected: false },
  ];

  for (const { name, error, expected } of cases) {
    it(`${name} -> ${String(expected)}`, () => {
      expect(isErrorRecoverable(error)).toBe(expected);
    });
  }
});
