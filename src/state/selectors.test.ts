import { describe, expect, it } from 'vitest';
import {
  getCurrentPageUnfollowers,
  getMaxPage,
  getUnfollowLogForDisplay,
  getUsersForDisplay,
  isWithoutProfilePicture,
} from './selectors';
import { UserNode, Typename } from '../model/user';
import { ScanningFilter } from '../model/scanning-filter';
import { UnfollowFilter } from '../model/unfollow-filter';
import { UnfollowLogEntry } from '../model/unfollow-log-entry';

function makeUser(overrides: Partial<UserNode> & Pick<UserNode, 'id' | 'username'>): UserNode {
  return {
    id: overrides.id,
    username: overrides.username,
    full_name: overrides.full_name ?? `Full ${overrides.username}`,
    profile_pic_url: overrides.profile_pic_url ?? 'https://x/p.jpg',
    is_private: overrides.is_private ?? false,
    is_verified: overrides.is_verified ?? false,
    followed_by_viewer: overrides.followed_by_viewer ?? true,
    follows_viewer: overrides.follows_viewer ?? false,
    requested_by_viewer: overrides.requested_by_viewer ?? false,
    reel: overrides.reel ?? {
      id: overrides.id,
      expiring_at: 0,
      has_pride_media: false,
      latest_reel_media: 0,
      seen: null,
      owner: { __typename: Typename.GraphUser, id: overrides.id, profile_pic_url: '', username: overrides.username },
    },
  };
}

const passAll: ScanningFilter = {
  showNonFollowers: true,
  showFollowers: true,
  showVerified: true,
  showPrivate: true,
  showWithOutProfilePicture: true,
};

describe('getMaxPage', () => {
  it('returns at least 1 even for an empty list', () => {
    expect(getMaxPage([])).toBe(1);
  });

  it('ceils the count over the page size', () => {
    const users = Array.from({ length: 51 }, (_, i) => makeUser({ id: String(i), username: `u${i}` }));
    expect(getMaxPage(users)).toBe(2);
  });
});

describe('getCurrentPageUnfollowers', () => {
  it('sorts alphabetically and slices the requested page', () => {
    const users = ['c', 'a', 'b'].map(c => makeUser({ id: c, username: c }));
    expect(getCurrentPageUnfollowers(users, 1).map(u => u.username)).toEqual(['a', 'b', 'c']);
  });

  it('returns empty when the page is out of range', () => {
    const users = [makeUser({ id: '1', username: 'a' })];
    expect(getCurrentPageUnfollowers(users, 2)).toEqual([]);
  });
});

describe('isWithoutProfilePicture', () => {
  it('detects placeholder URLs from WITHOUT_PROFILE_PICTURE_URL_IDS', () => {
    const user = makeUser({
      id: '1',
      username: 'x',
      profile_pic_url: 'https://x/44884218_345707102882519_2446069589734326272_n.jpg',
    });
    expect(isWithoutProfilePicture(user)).toBe(true);
  });

  it('returns false for a real profile pic', () => {
    expect(isWithoutProfilePicture(makeUser({ id: '1', username: 'x' }))).toBe(false);
  });
});

describe('getUsersForDisplay', () => {
  it('drops whitelisted users on the non_whitelisted tab', () => {
    const a = makeUser({ id: '1', username: 'a' });
    const b = makeUser({ id: '2', username: 'b' });
    const out = getUsersForDisplay([a, b], [b], 'non_whitelisted', '', passAll);
    expect(out).toEqual([a]);
  });

  it('keeps only whitelisted users on the whitelisted tab', () => {
    const a = makeUser({ id: '1', username: 'a' });
    const b = makeUser({ id: '2', username: 'b' });
    const out = getUsersForDisplay([a, b], [b], 'whitelisted', '', passAll);
    expect(out).toEqual([b]);
  });

  it('filters by privacy / verification / follower status', () => {
    const everyone = [
      makeUser({ id: '1', username: 'priv', is_private: true }),
      makeUser({ id: '2', username: 'verif', is_verified: true }),
      makeUser({ id: '3', username: 'follower', follows_viewer: true }),
      makeUser({ id: '4', username: 'plain' }),
    ];
    const filter: ScanningFilter = {
      showNonFollowers: false,
      showFollowers: true,
      showVerified: false,
      showPrivate: false,
      showWithOutProfilePicture: true,
    };
    const out = getUsersForDisplay(everyone, [], 'non_whitelisted', '', filter);
    expect(out.map(u => u.username)).toEqual(['follower']);
  });

  it('matches the search term against username and full_name', () => {
    const users = [
      makeUser({ id: '1', username: 'alice', full_name: 'Wonder Land' }),
      makeUser({ id: '2', username: 'bob', full_name: 'Builder' }),
    ];
    expect(getUsersForDisplay(users, [], 'non_whitelisted', 'wonder', passAll).map(u => u.username))
      .toEqual(['alice']);
    expect(getUsersForDisplay(users, [], 'non_whitelisted', 'BUILDER', passAll).map(u => u.username))
      .toEqual(['bob']);
  });
});

describe('getUnfollowLogForDisplay', () => {
  const entries: UnfollowLogEntry[] = [
    { user: makeUser({ id: '1', username: 'win' }), unfollowedSuccessfully: true },
    { user: makeUser({ id: '2', username: 'fail' }), unfollowedSuccessfully: false },
  ];

  it('filters out failed entries when showFailed is off', () => {
    const filter: UnfollowFilter = { showSucceeded: true, showFailed: false };
    expect(getUnfollowLogForDisplay(entries, '', filter).map(e => e.user.username)).toEqual(['win']);
  });

  it('filters out succeeded entries when showSucceeded is off', () => {
    const filter: UnfollowFilter = { showSucceeded: false, showFailed: true };
    expect(getUnfollowLogForDisplay(entries, '', filter).map(e => e.user.username)).toEqual(['fail']);
  });

  it('applies a search term to username', () => {
    const filter: UnfollowFilter = { showSucceeded: true, showFailed: true };
    expect(getUnfollowLogForDisplay(entries, 'fa', filter).map(e => e.user.username)).toEqual(['fail']);
  });
});
