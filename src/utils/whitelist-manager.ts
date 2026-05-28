import { UserNode } from '../model/user';
import { Timings } from '../model/timings';
import {
  LEGACY_TIMINGS_STORAGE_KEY,
  LEGACY_WHITELISTED_RESULTS_STORAGE_KEY,
  TIMINGS_STORAGE_KEY,
  WHITELISTED_RESULTS_STORAGE_KEY,
} from '../constants/constants';

/**
 * Export whitelist to a JSON file. No-op when the list is empty —
 * caller is responsible for guarding the UI.
 */
export const exportWhitelist = (whitelistedUsers: readonly UserNode[]): void => {
  if (whitelistedUsers.length === 0) {
    return;
  }

  const dataStr = JSON.stringify(whitelistedUsers, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `instagram-whitelist-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

/**
 * Import whitelist from a JSON file
 */
export const importWhitelist = (
  file: File,
  onSuccess: (users: readonly UserNode[]) => void,
  onError: (message: string) => void,
): void => {
  const reader = new FileReader();

  reader.onload = e => {
    try {
      const content = e.target?.result as string;
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        onError('Invalid file format: Expected an array of users');
        return;
      }
      const validated = parsed.filter(isWhitelistUserShape);
      if (validated.length !== parsed.length) {
        onError(`Invalid file format: ${parsed.length - validated.length} entries missing required fields (id, username)`);
        return;
      }
      onSuccess(validated);
    } catch (error) {
      onError(`Failed to parse JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  reader.onerror = () => {
    onError('Failed to read file');
  };

  reader.readAsText(file);
};

/**
 * Clear all whitelist data, including any pre-migration legacy slot.
 * Pure side-effect — caller must obtain user confirmation (e.g. via
 * useConfirm) before invoking.
 */
export const clearWhitelist = (): void => {
  try {
    localStorage.removeItem(WHITELISTED_RESULTS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_WHITELISTED_RESULTS_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear whitelist from localStorage', e);
  }
};

/**
 * Save whitelist to localStorage. Catches QuotaExceededError and
 * SecurityError (private browsing in some browsers blocks
 * localStorage writes) so the calling React effect does not crash.
 */
export const saveWhitelist = (whitelistedUsers: readonly UserNode[]): void => {
  try {
    localStorage.setItem(WHITELISTED_RESULTS_STORAGE_KEY, JSON.stringify(whitelistedUsers));
  } catch (e) {
    console.warn('Failed to save whitelist to localStorage', e);
  }
};

/**
 * Load whitelist from localStorage. Returns an empty array on any
 * failure (missing key, parse error, schema mismatch, localStorage
 * disabled). Corrupt entries are dropped silently — better to lose
 * a stale row than to crash the whole UI.
 *
 * On a cold v1 key, looks up the legacy unversioned key once and
 * migrates the data forward (validate → save under v1 → drop legacy).
 */
export const loadWhitelist = (): readonly UserNode[] => {
  const v1 = readWhitelistFromKey(WHITELISTED_RESULTS_STORAGE_KEY);
  if (v1 !== null) {
    return v1;
  }
  const legacy = readWhitelistFromKey(LEGACY_WHITELISTED_RESULTS_STORAGE_KEY);
  if (legacy === null) {
    return [];
  }
  // Migrate forward, then forget the legacy slot.
  saveWhitelist(legacy);
  try {
    localStorage.removeItem(LEGACY_WHITELISTED_RESULTS_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to drop legacy whitelist key', e);
  }
  return legacy;
};

function readWhitelistFromKey(key: string): readonly UserNode[] | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (e) {
    console.warn(`Failed to read ${key} from localStorage`, e);
    return null;
  }
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn(`${key} in localStorage is not valid JSON; ignoring`, e);
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const validated = parsed.filter(isWhitelistUserShape);
  if (validated.length !== parsed.length) {
    console.warn(`Dropped ${parsed.length - validated.length} malformed whitelist entries from ${key}`);
  }
  return validated;
}

/**
 * Merge imported whitelist with existing whitelist (avoiding duplicates)
 */
export const mergeWhitelists = (
  existing: readonly UserNode[],
  imported: readonly UserNode[],
): readonly UserNode[] => {
  const existingIds = new Set(existing.map(user => user.id));
  const uniqueImported = imported.filter(user => !existingIds.has(user.id));
  return [...existing, ...uniqueImported];
};

const isTimings = (value: unknown): value is Timings => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(timing => typeof timing === 'number');
};

/**
 * Save timings to localStorage
 */
export const saveTimings = (timings: Timings): void => {
  try {
    localStorage.setItem(TIMINGS_STORAGE_KEY, JSON.stringify(timings));
  } catch (e) {
    console.warn('Failed to save timings to localStorage', e);
  }
};

/**
 * Load timings from localStorage. On a cold v1 key, checks the
 * legacy unversioned key and migrates forward.
 */
export const loadTimings = (): Timings | null => {
  const v1 = readTimingsFromKey(TIMINGS_STORAGE_KEY);
  if (v1 !== null) {
    return v1;
  }
  const legacy = readTimingsFromKey(LEGACY_TIMINGS_STORAGE_KEY);
  if (legacy === null) {
    return null;
  }
  saveTimings(legacy);
  try {
    localStorage.removeItem(LEGACY_TIMINGS_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to drop legacy timings key', e);
  }
  return legacy;
};

function readTimingsFromKey(key: string): Timings | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (e) {
    console.warn(`Failed to read ${key} from localStorage`, e);
    return null;
  }
  if (raw === null) {
    return null;
  }
  try {
    const parsedTimings: unknown = JSON.parse(raw);
    return isTimings(parsedTimings) ? parsedTimings : null;
  } catch {
    return null;
  }
}

/**
 * Minimum-fields whitelist user guard. We only need `id` and
 * `username` from a whitelisted row at runtime; the rest of `UserNode`
 * is best-effort. Drop any row missing either.
 */
function isWhitelistUserShape(value: unknown): value is UserNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return typeof obj.id === 'string' && typeof obj.username === 'string';
}
