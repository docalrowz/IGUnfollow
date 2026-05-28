export const INSTAGRAM_HOSTNAME = 'www.instagram.com';
export const UNFOLLOWERS_PER_PAGE = 50;

/**
 * Versioned localStorage keys. When the persisted shape changes,
 * bump the suffix here and add a migration step in
 * `whitelist-manager.ts`. Old keys live in `LEGACY_*` until every
 * known user has migrated forward.
 */
export const WHITELISTED_RESULTS_STORAGE_KEY = 'iu_whitelist_v1';
export const TIMINGS_STORAGE_KEY = 'iu_timings_v1';
export const LEGACY_WHITELISTED_RESULTS_STORAGE_KEY = 'iu_whitelisted-results';
export const LEGACY_TIMINGS_STORAGE_KEY = 'iu_timings';

// TIMINGS CONSTANTS
export const DEFAULT_TIME_BETWEEN_SEARCH_CYCLES = 1000;
export const DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES = 10000;
export const DEFAULT_TIME_BETWEEN_UNFOLLOWS = 4000;
export const DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS = 300000;

// FILTER CONSTANTS
export const WITHOUT_PROFILE_PICTURE_URL_IDS = [
  '44884218_345707102882519_2446069589734326272_n',
  '464760996_1254146839119862_3605321457742435801_n',
];
