import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearWhitelist,
  loadTimings,
  loadWhitelist,
  mergeWhitelists,
  saveTimings,
  saveWhitelist,
} from './whitelist-manager';
import {
  LEGACY_TIMINGS_STORAGE_KEY,
  LEGACY_WHITELISTED_RESULTS_STORAGE_KEY,
  TIMINGS_STORAGE_KEY,
  WHITELISTED_RESULTS_STORAGE_KEY,
} from '../constants/constants';
import { Typename, UserNode } from '../model/user';
import { Timings } from '../model/timings';

const user = (id: string, username = `u_${id}`): UserNode => ({
  id,
  username,
  full_name: `Full ${id}`,
  profile_pic_url: '',
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
    owner: { __typename: Typename.GraphUser, id, profile_pic_url: '', username },
  },
});

const timings: Timings = {
  timeBetweenSearchCycles: 1000,
  timeToWaitAfterFiveSearchCycles: 10_000,
  timeBetweenUnfollows: 4000,
  timeToWaitAfterFiveUnfollows: 300_000,
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('whitelist persistence', () => {
  it('loadWhitelist returns [] when key is absent', () => {
    expect(loadWhitelist()).toEqual([]);
  });

  it('saveWhitelist + loadWhitelist round-trip', () => {
    saveWhitelist([user('1'), user('2')]);
    expect(loadWhitelist().map(u => u.id)).toEqual(['1', '2']);
  });

  it('loadWhitelist returns [] on corrupt JSON', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(WHITELISTED_RESULTS_STORAGE_KEY, '{not valid json');
    expect(loadWhitelist()).toEqual([]);
  });

  it('loadWhitelist drops entries missing id or username', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    localStorage.setItem(
      WHITELISTED_RESULTS_STORAGE_KEY,
      JSON.stringify([{ id: '1', username: 'ok' }, { id: '2' }, { username: 'noid' }, null]),
    );
    expect(loadWhitelist().map(u => u.id)).toEqual(['1']);
  });

  it('loadWhitelist returns [] when stored value is not an array', () => {
    localStorage.setItem(WHITELISTED_RESULTS_STORAGE_KEY, JSON.stringify({ id: '1' }));
    expect(loadWhitelist()).toEqual([]);
  });

  it('saveWhitelist swallows QuotaExceededError', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    expect(() => saveWhitelist([user('1')])).not.toThrow();
    setItem.mockRestore();
  });

  it('clearWhitelist removes both v1 and legacy keys', () => {
    saveWhitelist([user('1')]);
    localStorage.setItem(LEGACY_WHITELISTED_RESULTS_STORAGE_KEY, JSON.stringify([user('legacy')]));
    clearWhitelist();
    expect(localStorage.getItem(WHITELISTED_RESULTS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_WHITELISTED_RESULTS_STORAGE_KEY)).toBeNull();
  });
});

describe('whitelist legacy migration', () => {
  it('migrates legacy key to v1 on first load', () => {
    localStorage.setItem(
      LEGACY_WHITELISTED_RESULTS_STORAGE_KEY,
      JSON.stringify([user('1'), user('2')]),
    );
    const out = loadWhitelist();
    expect(out.map(u => u.id)).toEqual(['1', '2']);
    expect(localStorage.getItem(LEGACY_WHITELISTED_RESULTS_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(WHITELISTED_RESULTS_STORAGE_KEY) ?? '[]')).toHaveLength(2);
  });

  it('prefers v1 when both keys exist', () => {
    saveWhitelist([user('new')]);
    localStorage.setItem(LEGACY_WHITELISTED_RESULTS_STORAGE_KEY, JSON.stringify([user('old')]));
    expect(loadWhitelist().map(u => u.id)).toEqual(['new']);
    expect(localStorage.getItem(LEGACY_WHITELISTED_RESULTS_STORAGE_KEY)).not.toBeNull();
  });
});

describe('mergeWhitelists', () => {
  it('keeps existing order and appends only unique imports by id', () => {
    const existing = [user('1'), user('2')];
    const imported = [user('2'), user('3'), user('4')];
    expect(mergeWhitelists(existing, imported).map(u => u.id)).toEqual(['1', '2', '3', '4']);
  });
});

describe('timings persistence', () => {
  it('saveTimings + loadTimings round-trip', () => {
    saveTimings(timings);
    expect(loadTimings()).toEqual(timings);
  });

  it('loadTimings returns null when key is absent', () => {
    expect(loadTimings()).toBeNull();
  });

  it('loadTimings returns null when stored value fails schema', () => {
    localStorage.setItem(TIMINGS_STORAGE_KEY, JSON.stringify({ timeBetweenSearchCycles: 'not-a-number' }));
    expect(loadTimings()).toBeNull();
  });

  it('loadTimings returns null on corrupt JSON', () => {
    localStorage.setItem(TIMINGS_STORAGE_KEY, '{not valid');
    expect(loadTimings()).toBeNull();
  });

  it('migrates legacy timings key to v1', () => {
    localStorage.setItem(LEGACY_TIMINGS_STORAGE_KEY, JSON.stringify(timings));
    expect(loadTimings()).toEqual(timings);
    expect(localStorage.getItem(LEGACY_TIMINGS_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(TIMINGS_STORAGE_KEY) ?? 'null')).toEqual(timings);
  });

  it('saveTimings swallows storage errors', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(() => saveTimings(timings)).not.toThrow();
    setItem.mockRestore();
  });
});
