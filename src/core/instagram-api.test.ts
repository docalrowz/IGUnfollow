import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFollowingPage, unfollowUser } from './instagram-api';
import { InstagramErrorException, isInstagramErrorException } from './error-types';
import { UserNode } from '../model/user';

type FetchMock = ReturnType<typeof vi.fn>;

const QUERY_HASH = 'abcdef0123456789abcdef0123456789';

function setCookies(value: string): void {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => value,
  });
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function fakeUserNode(id: string): UserNode {
  return {
    id,
    username: `user_${id}`,
    full_name: `Full ${id}`,
    profile_pic_url: 'https://x/p.jpg',
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      owner: { __typename: 'GraphUser' as any, id, profile_pic_url: '', username: `user_${id}` },
    },
  };
}

function fakeEdgeFollowResponse(users: UserNode[], hasNext: boolean, endCursor = ''): Response {
  return jsonResponse(200, {
    data: {
      user: {
        edge_follow: {
          count: users.length,
          page_info: { has_next_page: hasNext, end_cursor: endCursor },
          edges: users.map(node => ({ node })),
        },
      },
    },
  });
}

let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  setCookies('ds_user_id=42; csrftoken=token-abc');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchFollowingPage', () => {
  it('returns parsed page on 200', async () => {
    const users = [fakeUserNode('1'), fakeUserNode('2')];
    fetchMock.mockResolvedValueOnce(fakeEdgeFollowResponse(users, true, 'next-cursor'));

    const page = await fetchFollowingPage(undefined, QUERY_HASH);

    expect(page.users).toEqual(users);
    expect(page.hasNext).toBe(true);
    expect(page.endCursor).toBe('next-cursor');
    expect(page.totalCount).toBe(2);
  });

  it('encodes cursor when provided', async () => {
    fetchMock.mockResolvedValueOnce(fakeEdgeFollowResponse([], false));

    await fetchFollowingPage('cursor-xyz', QUERY_HASH);

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('query_hash=' + QUERY_HASH);
    expect(calledUrl).toContain('%22after%22%3A%22cursor-xyz%22');
  });

  it('throws csrf_expired when ds_user_id cookie is missing', async () => {
    setCookies('');
    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'csrf_expired' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws rate_limit on 429 with retryAfter from header (ms)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '12' } }));

    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'rate_limit', retryAfter: 12_000 },
    });
  });

  it('throws csrf_expired on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'csrf_expired' },
    });
  });

  it('throws network on 5xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'network', retryable: true },
    });
  });

  it('throws network when fetch rejects', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'network', retryable: true },
    });
  });

  it('throws checkpoint when body says checkpoint_required', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { message: 'checkpoint_required' }));
    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'checkpoint', requiresUserAction: true },
    });
  });

  it('throws checkpoint when body has checkpoint_url', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { checkpoint_url: '/challenge/' }),
    );
    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'checkpoint', requiresUserAction: true },
    });
  });

  it('throws rate_limit on feedback_required body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { message: 'feedback_required' }));
    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'rate_limit' },
    });
  });

  it('throws unknown when edge_follow is missing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { user: {} } }));
    let caught: unknown;
    try {
      await fetchFollowingPage(undefined, QUERY_HASH);
    } catch (e) {
      caught = e;
    }
    expect(isInstagramErrorException(caught)).toBe(true);
    expect((caught as InstagramErrorException).error.kind).toBe('unknown');
  });

  it('throws unknown when response is not valid JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not-json', { status: 200 }));
    await expect(fetchFollowingPage(undefined, QUERY_HASH)).rejects.toMatchObject({
      error: { kind: 'unknown' },
    });
  });
});

describe('unfollowUser', () => {
  it('resolves on 200 OK', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'ok' }));
    await expect(unfollowUser('123')).resolves.toBeUndefined();
  });

  it('re-reads csrftoken from cookie on each call', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'ok' }));
    setCookies('ds_user_id=1; csrftoken=first');
    await unfollowUser('1');
    setCookies('ds_user_id=1; csrftoken=second');
    await unfollowUser('2');

    const headersOne = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    const headersTwo = fetchMock.mock.calls[1][1].headers as Record<string, string>;
    expect(headersOne['x-csrftoken']).toBe('first');
    expect(headersTwo['x-csrftoken']).toBe('second');
  });

  it('throws csrf_expired when csrftoken cookie is missing', async () => {
    setCookies('ds_user_id=1');
    await expect(unfollowUser('1')).rejects.toMatchObject({
      error: { kind: 'csrf_expired' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws rate_limit on 429', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '5' } }));
    await expect(unfollowUser('1')).rejects.toMatchObject({
      error: { kind: 'rate_limit', retryAfter: 5000 },
    });
  });

  it('throws checkpoint on 403 with checkpoint_required body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { message: 'checkpoint_required' }));
    await expect(unfollowUser('1')).rejects.toMatchObject({
      error: { kind: 'checkpoint', requiresUserAction: true },
    });
  });

  it('throws rate_limit on 403 with feedback_required body', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { message: 'feedback_required' }));
    await expect(unfollowUser('1')).rejects.toMatchObject({
      error: { kind: 'rate_limit' },
    });
  });

  it('falls back to csrf_expired on 403 with no recognized body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(unfollowUser('1')).rejects.toMatchObject({
      error: { kind: 'csrf_expired' },
    });
  });

  it('throws network on 5xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 502 }));
    await expect(unfollowUser('1')).rejects.toMatchObject({
      error: { kind: 'network', retryable: true },
    });
  });

  it('throws rate_limit on 200 body with feedback_required', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { message: 'feedback_required' }));
    await expect(unfollowUser('1')).rejects.toMatchObject({
      error: { kind: 'rate_limit' },
    });
  });
});
