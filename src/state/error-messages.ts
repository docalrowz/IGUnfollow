import { InstagramError } from '../core/error-types';

/**
 * Pure mappings from `InstagramError` to user-facing strings.
 *
 * Split out of `main.tsx` so the copy is testable and translatable
 * without dragging in React. Add a new `kind` to InstagramError and
 * TypeScript will force both switches to be updated here.
 */

export function errorTitle(error: InstagramError): string {
  switch (error.kind) {
    case 'checkpoint': return 'Instagram requires you to verify this account';
    case 'rate_limit': return 'Rate-limited by Instagram';
    case 'csrf_expired': return 'Your Instagram session expired';
    case 'network': return 'Network error';
    case 'unknown': return 'Unexpected response from Instagram';
  }
}

export function errorDetail(error: InstagramError): string {
  switch (error.kind) {
    case 'checkpoint':
      return 'The scan was stopped to avoid making things worse. Open Instagram in a normal tab, resolve the checkpoint, then come back.';
    case 'rate_limit':
      return 'Too many requests have been made. The circuit breaker tripped to protect your account.';
    case 'csrf_expired':
      return 'Instagram rotated your session token. Refresh the page and log back in.';
    case 'network':
      return 'Could not reach Instagram. Check your connection and try again.';
    case 'unknown':
      return `Status ${error.status}. See the developer console for the raw response.`;
  }
}
