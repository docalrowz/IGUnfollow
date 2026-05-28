import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { State } from '../model/state';
import { Timings } from '../model/timings';
import { UserNode } from '../model/user';
import { AdaptiveRateLimiter } from '../core/rate-limiter';
import { CircuitBreaker } from '../core/circuit-breaker';
import { fetchFollowingPage } from '../core/instagram-api';
import { awaitQueryHash } from '../core/query-hash';
import { sleep } from '../utils/utils';
import { handleApiError, ToastState } from './api-error-handler';

interface UseScannerArgs {
  readonly state: State;
  readonly setState: Dispatch<SetStateAction<State>>;
  readonly setToast: Dispatch<SetStateAction<ToastState>>;
  readonly timings: Timings;
  readonly isLocalPreview: boolean;
}

/**
 * Drives the scan loop while `state.status === 'scanning'`.
 *
 * Owns the per-session AdaptiveRateLimiter and CircuitBreaker (fresh
 * instances per scan so a previous bad session does not poison the
 * next one). Reads `state.paused` from a ref synced every render —
 * the scan closure captures the value at start of effect, so we need
 * a live channel into the latest state.
 */
export function useScanner({
  state,
  setState,
  setToast,
  timings,
  isLocalPreview,
}: UseScannerArgs): void {
  const pausedRef = useRef(false);
  useEffect(() => {
    pausedRef.current = state.status === 'scanning' ? state.paused : false;
  });

  useEffect(() => {
    const scan = async () => {
      if (state.status !== 'scanning' || isLocalPreview) {
        return;
      }
      // Probe-seed: wait briefly for Instagram to make a natural
      // graphql/query so we pick up a live query_hash before falling
      // back to the hardcoded one.
      await awaitQueryHash();

      const limiter = new AdaptiveRateLimiter({
        baseDelay: timings.timeBetweenSearchCycles,
        jitterRatio: 0.2,
      });
      const breaker = new CircuitBreaker();
      const results: UserNode[] = [...state.results];
      let scrollCycle = 0;
      let cursor: string | undefined;
      let hasNext = true;
      let currentFollowedUsersCount = 0;
      let totalFollowedUsersCount = -1;

      while (hasNext) {
        try {
          breaker.ensureClosed();
          const page = await fetchFollowingPage(cursor);
          limiter.onSuccess();
          breaker.recordSuccess();

          if (totalFollowedUsersCount === -1) {
            totalFollowedUsersCount = page.totalCount;
          }
          hasNext = page.hasNext;
          cursor = page.endCursor;
          currentFollowedUsersCount += page.users.length;
          page.users.forEach(u => results.push(u));

          setState(prevState => {
            if (prevState.status !== 'scanning') {
              return prevState;
            }
            return {
              ...prevState,
              percentage: Math.round((currentFollowedUsersCount / totalFollowedUsersCount) * 100),
              results,
            };
          });
        } catch (e) {
          const handled = await handleApiError(e, limiter, breaker, 'scanning', setState, setToast);
          if (handled === 'halt') {
            return;
          }
          continue;
        }

        while (pausedRef.current) {
          await sleep(1000);
        }

        const microPause = Math.floor(Math.random() * 1500) + 500;
        await sleep(microPause);

        await limiter.wait();

        scrollCycle++;
        if (scrollCycle > 6) {
          scrollCycle = 0;
          const longSleepVar = Math.max(
            0,
            timings.timeToWaitAfterFiveSearchCycles + (Math.random() * 10000 - 5000),
          );
          setToast({ show: true, text: `Sleeping ${Math.round(longSleepVar / 1000)} seconds to prevent getting temp blocked` });
          await sleep(longSleepVar);
        }
        setToast({ show: false });
      }
      setToast({ show: true, text: 'Scanning completed!' });
    };
    void scan();
    // Same intentional deps as the original effect: re-firing on every
    // `timings` change would restart the scan from scratch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);
}
