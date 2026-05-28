import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  _resetDbForTests,
  clearPendingQueue,
  hasPendingQueue,
  loadPendingQueue,
  savePendingQueue,
  UnfollowQueueSnapshot,
} from './unfollow-queue';
import { Typename, UserNode } from '../model/user';

function fakeUser(id: string): UserNode {
  return {
    id,
    username: `user_${id}`,
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
      owner: { __typename: Typename.GraphUser, id, profile_pic_url: '', username: `user_${id}` },
    },
  };
}

const snapshot: UnfollowQueueSnapshot = {
  remainingUsers: [fakeUser('1'), fakeUser('2')],
  unfollowLog: [{ user: fakeUser('0'), unfollowedSuccessfully: true }],
  startedAt: 1_700_000_000_000,
  lastSavedAt: 1_700_000_005_000,
};

beforeEach(() => {
  // Each test gets a clean IDB instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  _resetDbForTests();
});

afterEach(async () => {
  await clearPendingQueue();
});

describe('unfollow-queue', () => {
  it('returns null when no pending queue exists', async () => {
    expect(await loadPendingQueue()).toBeNull();
    expect(await hasPendingQueue()).toBe(false);
  });

  it('round-trips a snapshot through save/load', async () => {
    await savePendingQueue(snapshot);
    const restored = await loadPendingQueue();
    expect(restored).toEqual(snapshot);
  });

  it('hasPendingQueue is true after save with remaining users', async () => {
    await savePendingQueue(snapshot);
    expect(await hasPendingQueue()).toBe(true);
  });

  it('hasPendingQueue is false when remaining users is empty', async () => {
    await savePendingQueue({ ...snapshot, remainingUsers: [] });
    expect(await hasPendingQueue()).toBe(false);
  });

  it('save overwrites the previous record', async () => {
    await savePendingQueue(snapshot);
    const updated: UnfollowQueueSnapshot = {
      ...snapshot,
      remainingUsers: [fakeUser('3')],
      lastSavedAt: snapshot.lastSavedAt + 1000,
    };
    await savePendingQueue(updated);
    expect(await loadPendingQueue()).toEqual(updated);
  });

  it('clearPendingQueue removes the record', async () => {
    await savePendingQueue(snapshot);
    await clearPendingQueue();
    expect(await loadPendingQueue()).toBeNull();
    expect(await hasPendingQueue()).toBe(false);
  });
});
