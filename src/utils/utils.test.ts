import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertUnreachable,
  copyListToClipboard,
  exportToCSV,
  exportToJSON,
  getCookie,
  sleep,
} from './utils';
import { UserNode, Typename } from '../model/user';

function makeUser(overrides: Partial<UserNode>): UserNode {
  return {
    id: '1',
    username: 'alice',
    full_name: 'Alice',
    profile_pic_url: 'pic',
    is_private: false,
    is_verified: false,
    followed_by_viewer: true,
    follows_viewer: false,
    requested_by_viewer: false,
    reel: {
      id: '1',
      expiring_at: 0,
      has_pride_media: false,
      latest_reel_media: 0,
      seen: null,
      owner: {
        __typename: Typename.GraphUser,
        id: '1',
        profile_pic_url: 'pic',
        username: 'alice',
      },
    },
    ...overrides,
  };
}

describe('assertUnreachable', () => {
  it('throws when a switch falls through', () => {
    expect(() => assertUnreachable('oops' as never)).toThrow('Statement should be unreachable');
  });
});

describe('sleep', () => {
  it('resolves after the requested delay', async () => {
    vi.useFakeTimers();
    const promise = sleep(500);
    vi.advanceTimersByTime(500);
    await expect(promise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});

describe('getCookie', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      configurable: true,
      value: 'ds_user_id=12345; csrftoken=abc-def; sessionid=xyz',
    });
  });

  it('returns the value for a named cookie', () => {
    expect(getCookie('csrftoken')).toBe('abc-def');
  });

  it('returns null when the cookie is missing', () => {
    expect(getCookie('not_here')).toBeNull();
  });

  it('returns the first segment when other cookies follow', () => {
    expect(getCookie('ds_user_id')).toBe('12345');
  });
});

describe('copyListToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes a newline-joined alphabetical list to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await copyListToClipboard([
      makeUser({ username: 'charlie' }),
      makeUser({ username: 'alice' }),
      makeUser({ username: 'bob' }),
    ]);

    expect(writeText).toHaveBeenCalledWith('alice\nbob\ncharlie');
  });
});

describe('exportToJSON / exportToCSV', () => {
  it('triggers a download with the right filename for JSON', () => {
    const setAttribute = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const fakeAnchor = { setAttribute, click, remove } as unknown as HTMLAnchorElement;
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(fakeAnchor);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockReturnValue(fakeAnchor as never);

    exportToJSON([makeUser({ username: 'alice' })]);

    expect(createSpy).toHaveBeenCalledWith('a');
    const attrs = Object.fromEntries(setAttribute.mock.calls);
    expect(attrs.download).toBe('instagram_unfollowers.json');
    expect(String(attrs.href)).toMatch(/^data:text\/json;/);
    expect(click).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalled();
    createSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it('triggers a download with the right filename for CSV', () => {
    const setAttribute = vi.fn();
    const click = vi.fn();
    const remove = vi.fn();
    const fakeAnchor = { setAttribute, click, remove } as unknown as HTMLAnchorElement;
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(fakeAnchor);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockReturnValue(fakeAnchor as never);

    exportToCSV([makeUser({ username: 'alice', full_name: 'Alice "A." Doe' })]);

    const attrs = Object.fromEntries(setAttribute.mock.calls);
    expect(attrs.download).toBe('instagram_unfollowers.csv');
    expect(String(attrs.href)).toContain('alice');
    expect(String(attrs.href)).toContain('Alice');
    expect(click).toHaveBeenCalledTimes(1);
    createSpy.mockRestore();
    appendSpy.mockRestore();
  });
});
