import { describe, expect, it } from 'vitest';
import { errorDetail, errorTitle } from './error-messages';
import { InstagramError } from '../core/error-types';

const cases: ReadonlyArray<{ error: InstagramError; titleIncludes: string; detailIncludes: string }> = [
  { error: { kind: 'rate_limit' }, titleIncludes: 'Rate-limited', detailIncludes: 'circuit breaker' },
  { error: { kind: 'checkpoint', requiresUserAction: true }, titleIncludes: 'verify', detailIncludes: 'normal tab' },
  { error: { kind: 'csrf_expired' }, titleIncludes: 'session expired', detailIncludes: 'Refresh' },
  { error: { kind: 'network', retryable: true }, titleIncludes: 'Network', detailIncludes: 'connection' },
  { error: { kind: 'unknown', raw: null, status: 418 }, titleIncludes: 'Unexpected', detailIncludes: '418' },
];

describe('errorTitle / errorDetail', () => {
  for (const { error, titleIncludes, detailIncludes } of cases) {
    it(`${error.kind} title contains "${titleIncludes}"`, () => {
      expect(errorTitle(error)).toContain(titleIncludes);
    });
    it(`${error.kind} detail contains "${detailIncludes}"`, () => {
      expect(errorDetail(error)).toContain(detailIncludes);
    });
  }
});
