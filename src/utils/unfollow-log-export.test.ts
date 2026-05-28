import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportUnfollowLogToCSV, exportUnfollowLogToJSON } from './utils';
import { UnfollowLogEntry } from '../model/unfollow-log-entry';
import { Typename, UserNode } from '../model/user';

function makeUser(id: string, username: string, fullName: string): UserNode {
  return {
    id,
    username,
    full_name: fullName,
    profile_pic_url: `https://example.com/${username}.png`,
    is_private: false,
    is_verified: false,
    followed_by_viewer: true,
    follows_viewer: false,
    requested_by_viewer: false,
    reel: {
      id,
      expiring_at: 0,
      has_pride_media: false,
      latest_reel_media: 0,
      seen: null,
      owner: {
        __typename: Typename.GraphUser,
        id,
        profile_pic_url: '',
        username,
      },
    },
  };
}

describe('unfollow log export helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('JSON export downloads a data URI with the serialized log', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const setAttribute = vi.fn();
    const fakeAnchor = { setAttribute, click, remove } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(fakeAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => fakeAnchor);

    const entries: UnfollowLogEntry[] = [
      { user: makeUser('1', 'alina.frames', 'Alina Moreno'), unfollowedSuccessfully: true },
      { user: makeUser('2', 'brassandbone', 'Theo "Tay" Walsh'), unfollowedSuccessfully: false },
    ];

    exportUnfollowLogToJSON(entries);

    const hrefCall = setAttribute.mock.calls.find(([attr]) => attr === 'href');
    expect(hrefCall).toBeDefined();
    const href = hrefCall[1] as string;
    expect(href.startsWith('data:text/json;charset=utf-8,')).toBe(true);

    const decoded = decodeURIComponent(href.replace('data:text/json;charset=utf-8,', ''));
    const payload = JSON.parse(decoded);
    expect(payload).toEqual([
      { username: 'alina.frames', full_name: 'Alina Moreno', id: '1', unfollowed_successfully: true },
      { username: 'brassandbone', full_name: 'Theo "Tay" Walsh', id: '2', unfollowed_successfully: false },
    ]);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
  });

  it('CSV export escapes embedded quotes in the full name column', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const setAttribute = vi.fn();
    const fakeAnchor = { setAttribute, click, remove } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValue(fakeAnchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => fakeAnchor);

    const entries: UnfollowLogEntry[] = [
      { user: makeUser('1', 'alina.frames', 'Theo "Tay" Walsh'), unfollowedSuccessfully: true },
    ];

    exportUnfollowLogToCSV(entries);

    const href = (setAttribute.mock.calls.find(([attr]) => attr === 'href')![1] as string);
    const decoded = decodeURIComponent(href.replace('data:text/csv;charset=utf-8,', ''));
    expect(decoded.split('\n')[0]).toBe('username,full_name,id,unfollowed_successfully');
    expect(decoded).toContain('"Theo ""Tay"" Walsh"');
    expect(decoded).toContain('true');
  });
});
