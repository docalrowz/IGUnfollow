import { openDB, IDBPDatabase } from 'idb';
import { UserNode } from '../model/user';
import { UnfollowLogEntry } from '../model/unfollow-log-entry';

/**
 * Persists an in-progress unfollow batch to IndexedDB so an accidental
 * tab close, refresh, or browser crash does not lose the user's place.
 *
 * Persistence model:
 *  - One database, one object store, one record (`SINGLETON_KEY`).
 *    There is only ever one batch in flight; we overwrite, not append.
 *  - The hook calling `save()` writes after every N successful
 *    actions (see useUnfollower). The N=5 cadence comes from the spec
 *    and balances IDB write cost against blast radius on a crash.
 *  - On mount the hook calls `load()`; a non-null result is offered
 *    to the user as a resume prompt.
 *
 * Schema migrations: this is v1. Bumping the schema means raising
 * `DB_VERSION` and handling the `upgrade` callback below.
 */

const DB_NAME = 'iu-unfollow-queue';
const DB_VERSION = 1;
const STORE = 'queue';
const SINGLETON_KEY = 'current';

export interface UnfollowQueueSnapshot {
  readonly remainingUsers: readonly UserNode[];
  readonly unfollowLog: readonly UnfollowLogEntry[];
  readonly startedAt: number;
  readonly lastSavedAt: number;
}

interface StoredSnapshot extends UnfollowQueueSnapshot {
  readonly id: typeof SINGLETON_KEY;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (dbPromise === null) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadPendingQueue(): Promise<UnfollowQueueSnapshot | null> {
  const handle = await db();
  const stored = await handle.get(STORE, SINGLETON_KEY) as StoredSnapshot | undefined;
  if (stored === undefined) {
    return null;
  }
  const { id: _id, ...snapshot } = stored;
  return snapshot;
}

export async function savePendingQueue(snapshot: UnfollowQueueSnapshot): Promise<void> {
  const handle = await db();
  const record: StoredSnapshot = { id: SINGLETON_KEY, ...snapshot };
  await handle.put(STORE, record);
}

export async function clearPendingQueue(): Promise<void> {
  const handle = await db();
  await handle.delete(STORE, SINGLETON_KEY);
}

export async function hasPendingQueue(): Promise<boolean> {
  const snapshot = await loadPendingQueue();
  return snapshot !== null && snapshot.remainingUsers.length > 0;
}

/** Test helper — drops the cached connection so a new DB can be opened. */
export function _resetDbForTests(): void {
  dbPromise = null;
}
