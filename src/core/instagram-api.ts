import { InstagramErrorException } from './error-types';
import { getQueryHash } from './query-hash';
import { UserNode } from '../model/user';
import { getCookie } from '../utils/utils';

/**
 * Thin, fully-typed wrapper around the two Instagram private endpoints
 * this app talks to.
 *
 * Responsibilities owned here:
 *  - Build URLs (so the query_hash strategy lives in one place).
 *  - Re-read `csrftoken` from `document.cookie` on EVERY unfollow call.
 *    Instagram rotates the token mid-session; reading it once at the
 *    top of a batch was the silent-failure source we are killing.
 *  - Map HTTP status + response body shapes onto the discriminated
 *    `InstagramError` union, so the rest of the app branches on data
 *    instead of inspecting unstructured response objects.
 *
 * Anything beyond that (retry, backoff, breaker) belongs to the
 * caller, not here.
 */

export interface FollowingPage {
  readonly users: readonly UserNode[];
  readonly hasNext: boolean;
  readonly endCursor: string;
  readonly totalCount: number;
}

export async function fetchFollowingPage(
  cursor: string | undefined,
  queryHash: string = getQueryHash(),
): Promise<FollowingPage> {
  const dsUserId = getCookie('ds_user_id');
  if (dsUserId === null) {
    throw new InstagramErrorException({ kind: 'csrf_expired' });
  }

  const baseVariables: Record<string, string> = {
    id: dsUserId,
    include_reel: 'true',
    fetch_mutual: 'false',
    first: '24',
  };
  if (cursor !== undefined) {
    baseVariables.after = cursor;
  }
  const variables = JSON.stringify(baseVariables);
  const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(variables)}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new InstagramErrorException({ kind: 'network', retryable: true });
  }

  throwForStatus(response);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new InstagramErrorException({
      kind: 'unknown',
      raw: 'invalid json',
      status: response.status,
    });
  }

  throwForBodyShape(body, response.status);

  const edgeFollow = readEdgeFollow(body);
  if (edgeFollow === null) {
    throw new InstagramErrorException({ kind: 'unknown', raw: body, status: response.status });
  }

  return {
    users: edgeFollow.edges.map(edge => edge.node),
    hasNext: edgeFollow.page_info.has_next_page,
    endCursor: edgeFollow.page_info.end_cursor,
    totalCount: edgeFollow.count,
  };
}

export async function unfollowUser(userId: string): Promise<void> {
  const csrfToken = getCookie('csrftoken');
  if (csrfToken === null) {
    throw new InstagramErrorException({ kind: 'csrf_expired' });
  }

  const url = `https://www.instagram.com/web/friendships/${userId}/unfollow/`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-csrftoken': csrfToken,
      },
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
    });
  } catch {
    throw new InstagramErrorException({ kind: 'network', retryable: true });
  }

  if (response.status === 429) {
    throw new InstagramErrorException({
      kind: 'rate_limit',
      retryAfter: parseRetryAfter(response.headers.get('retry-after')),
    });
  }
  if (response.status === 401) {
    throw new InstagramErrorException({ kind: 'csrf_expired' });
  }
  if (response.status === 403) {
    const body = await safeJson(response);
    const bodyError = errorFromBody(body, response.status);
    if (bodyError !== null) {
      throw new InstagramErrorException(bodyError);
    }
    throw new InstagramErrorException({ kind: 'csrf_expired' });
  }
  if (response.status >= 500) {
    throw new InstagramErrorException({ kind: 'network', retryable: true });
  }
  if (!response.ok) {
    const body = await safeJson(response);
    throw new InstagramErrorException({ kind: 'unknown', raw: body, status: response.status });
  }

  const body = await safeJson(response);
  const bodyError = errorFromBody(body, response.status);
  if (bodyError !== null) {
    throw new InstagramErrorException(bodyError);
  }
}

function throwForStatus(response: Response): void {
  if (response.status === 429) {
    throw new InstagramErrorException({
      kind: 'rate_limit',
      retryAfter: parseRetryAfter(response.headers.get('retry-after')),
    });
  }
  if (response.status === 401) {
    throw new InstagramErrorException({ kind: 'csrf_expired' });
  }
  if (response.status >= 500) {
    throw new InstagramErrorException({ kind: 'network', retryable: true });
  }
  if (!response.ok) {
    throw new InstagramErrorException({ kind: 'unknown', raw: null, status: response.status });
  }
}

function throwForBodyShape(body: unknown, status: number): void {
  const bodyError = errorFromBody(body, status);
  if (bodyError !== null) {
    throw new InstagramErrorException(bodyError);
  }
}

function errorFromBody(body: unknown, status: number): import('./error-types').InstagramError | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const obj = body as Record<string, unknown>;
  if (obj.message === 'checkpoint_required' || typeof obj.checkpoint_url === 'string') {
    return { kind: 'checkpoint', requiresUserAction: true };
  }
  if (obj.message === 'feedback_required' || obj.spam === true) {
    return { kind: 'rate_limit' };
  }
  if (obj.status === 'fail') {
    return { kind: 'unknown', raw: body, status };
  }
  return null;
}

interface EdgeFollow {
  readonly count: number;
  readonly page_info: { readonly has_next_page: boolean; readonly end_cursor: string };
  readonly edges: ReadonlyArray<{ readonly node: UserNode }>;
}

function readEdgeFollow(body: unknown): EdgeFollow | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const data = (body as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const user = (data as Record<string, unknown>).user;
  if (typeof user !== 'object' || user === null) {
    return null;
  }
  const edgeFollow = (user as Record<string, unknown>).edge_follow;
  if (typeof edgeFollow !== 'object' || edgeFollow === null) {
    return null;
  }
  return edgeFollow as unknown as EdgeFollow;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseRetryAfter(header: string | null): number | undefined {
  if (header === null) {
    return undefined;
  }
  const seconds = parseInt(header, 10);
  if (Number.isNaN(seconds)) {
    return undefined;
  }
  return seconds * 1000;
}
