import { UserNode } from '../model/user';
import { UNFOLLOWERS_PER_PAGE, WITHOUT_PROFILE_PICTURE_URL_IDS } from '../constants/constants';
import { ScanningTab } from '../model/scanning-tab';
import { ScanningFilter } from '../model/scanning-filter';
import { UnfollowLogEntry } from '../model/unfollow-log-entry';
import { UnfollowFilter } from '../model/unfollow-filter';
import { assertUnreachable } from '../utils/utils';

/**
 * Pure functions that derive view-data from the current state.
 *
 * Lives outside the components so the same logic can be unit-tested
 * and reused from the scanner / unfollower hooks without dragging in
 * React. No side effects, no I/O — input in, view-data out.
 */

export function getMaxPage(nonFollowersList: readonly UserNode[]): number {
  const pageCalc = Math.ceil(nonFollowersList.length / UNFOLLOWERS_PER_PAGE);
  return pageCalc < 1 ? 1 : pageCalc;
}

export function getCurrentPageUnfollowers(
  nonFollowersList: readonly UserNode[],
  currentPage: number,
): readonly UserNode[] {
  const sortedList = [...nonFollowersList].sort((a, b) => (a.username > b.username ? 1 : -1));
  return sortedList.splice(UNFOLLOWERS_PER_PAGE * (currentPage - 1), UNFOLLOWERS_PER_PAGE);
}

export function isWithoutProfilePicture(user: UserNode): boolean {
  return WITHOUT_PROFILE_PICTURE_URL_IDS.some(id => user.profile_pic_url.includes(id));
}

export function getUsersForDisplay(
  results: readonly UserNode[],
  whitelistedResults: readonly UserNode[],
  currentTab: ScanningTab,
  searchTerm: string,
  filter: ScanningFilter,
): readonly UserNode[] {
  // O(n + m). Previous Array.find per row was O(n*m), which gets slow
  // fast on large follow counts (1k follows + 500 whitelist = 500k ops
  // per render). Also lowercase the search term once instead of twice
  // per row.
  const whitelistedIds = new Set<string>();
  for (const u of whitelistedResults) {
    whitelistedIds.add(u.id);
  }
  const lowerSearch = searchTerm.toLowerCase();
  const hasSearch = searchTerm !== '';
  const users: UserNode[] = [];
  for (const result of results) {
    const isWhitelisted = whitelistedIds.has(result.id);
    switch (currentTab) {
      case 'non_whitelisted':
        if (isWhitelisted) {
          continue;
        }
        break;
      case 'whitelisted':
        if (!isWhitelisted) {
          continue;
        }
        break;
      default:
        assertUnreachable(currentTab);
    }
    if (!filter.showPrivate && result.is_private) {
      continue;
    }
    if (!filter.showVerified && result.is_verified) {
      continue;
    }
    if (!filter.showFollowers && result.follows_viewer) {
      continue;
    }
    if (!filter.showNonFollowers && !result.follows_viewer) {
      continue;
    }
    if (!filter.showWithOutProfilePicture && isWithoutProfilePicture(result)) {
      continue;
    }
    if (hasSearch) {
      const userMatchesSearchTerm =
        result.username.toLowerCase().includes(lowerSearch) ||
        result.full_name.toLowerCase().includes(lowerSearch);
      if (!userMatchesSearchTerm) {
        continue;
      }
    }
    users.push(result);
  }
  return users;
}

export function getUnfollowLogForDisplay(
  log: readonly UnfollowLogEntry[],
  searchTerm: string,
  filter: UnfollowFilter,
): readonly UnfollowLogEntry[] {
  const lowerSearch = searchTerm.toLowerCase();
  const hasSearch = searchTerm !== '';
  const entries: UnfollowLogEntry[] = [];
  for (const entry of log) {
    if (!filter.showSucceeded && entry.unfollowedSuccessfully) {
      continue;
    }
    if (!filter.showFailed && !entry.unfollowedSuccessfully) {
      continue;
    }
    if (hasSearch && !entry.user.username.toLowerCase().includes(lowerSearch)) {
      continue;
    }
    entries.push(entry);
  }
  return entries;
}
