import { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { State } from '../model/state';
import { Timings } from '../model/timings';
import { AdaptiveRateLimiter } from '../core/rate-limiter';
import { CircuitBreaker } from '../core/circuit-breaker';
import { unfollowUser } from '../core/instagram-api';
import {
  clearPendingQueue,
  loadPendingQueue,
  savePendingQueue,
} from '../core/unfollow-queue';
import { sleep } from '../utils/utils';
import { handleApiError, ToastState } from './api-error-handler';

const SAVE_EVERY_N_ACTIONS = 5;

interface UseUnfollowerArgs {
  readonly state: State;
  readonly setState: Dispatch<SetStateAction<State>>;
  readonly setToast: Dispatch<SetStateAction<ToastState>>;
  readonly timings: Timings;
  readonly isLocalPreview: boolean;
  readonly confirm: (message: string) => Promise<boolean>;
}

async function persistRemaining(state: State, startedAt: number, nextIndex: number): Promise<void> {
  if (state.status !== 'unfollowing') {
    return;
  }
  await savePendingQueue({
    remainingUsers: state.selectedResults.slice(nextIndex),
    unfollowLog: state.unfollowLog,
    startedAt,
    lastSavedAt: Date.now(),
  });
}

async function promptResumeIfQueued(
  confirm: (message: string) => Promise<boolean>,
  setState: Dispatch<SetStateAction<State>>,
): Promise<void> {
  let snapshot;
  try {
    snapshot = await loadPendingQueue();
  } catch (e) {
    console.error('Failed to load pending unfollow queue', e);
    return;
  }
  if (snapshot === null || snapshot.remainingUsers.length === 0) {
    return;
  }
  const hours = ((Date.now() - snapshot.startedAt) / 3_600_000).toFixed(1);
  const ok = await confirm(
    `A previous unfollow batch was interrupted ${hours}h ago with ${snapshot.remainingUsers.length} users remaining. Resume?`,
  );
  if (!ok) {
    await clearPendingQueue();
    return;
  }
  setState({
    status: 'unfollowing',
    searchTerm: '',
    percentage: 0,
    selectedResults: snapshot.remainingUsers,
    unfollowLog: [...snapshot.unfollowLog],
    filter: { showSucceeded: true, showFailed: true },
  });
}

/**
 * Owns the unfollow loop and the persistent unfollow queue:
 *
 *  - On mount (status === 'initial') it asks IndexedDB whether a
 *    previous batch was interrupted; if so, it prompts the user to
 *    resume and lifts the saved snapshot back into state.
 *  - While running it writes a fresh snapshot to IndexedDB every
 *    `SAVE_EVERY_N_ACTIONS` actions so a tab close costs at most
 *    that many unfollows.
 *  - When the batch finishes naturally it clears the queue.
 */
export function useUnfollower({
  state,
  setState,
  setToast,
  timings,
  isLocalPreview,
  confirm,
}: UseUnfollowerArgs): void {
  const resumePromptShown = useRef(false);

  useEffect(() => {
    if (isLocalPreview || resumePromptShown.current || state.status !== 'initial') {
      return;
    }
    resumePromptShown.current = true;
    void promptResumeIfQueued(confirm, setState);
    // confirm + setState are stable references from context / React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  useEffect(() => {
    const unfollow = async () => {
      if (state.status !== 'unfollowing' || isLocalPreview) {
        return;
      }
      const limiter = new AdaptiveRateLimiter({
        baseDelay: timings.timeBetweenUnfollows,
        jitterRatio: 0.2,
      });
      const breaker = new CircuitBreaker();
      const startedAt = Date.now();
      let counter = 0;
      let actionsSinceSave = 0;

      for (let i = 0; i < state.selectedResults.length; i++) {
        const user = state.selectedResults[i];
        counter += 1;
        const percentage = Math.round((counter / state.selectedResults.length) * 100);

        let success: boolean;
        try {
          breaker.ensureClosed();
          await unfollowUser(user.id);
          limiter.onSuccess();
          breaker.recordSuccess();
          success = true;
        } catch (e) {
          const handled = await handleApiError(e, limiter, breaker, 'unfollowing', setState, setToast);
          if (handled === 'halt') {
            await persistRemaining(state, startedAt, i);
            return;
          }
          success = false;
        }

        setState(prevState => {
          if (prevState.status !== 'unfollowing') {
            return prevState;
          }
          return {
            ...prevState,
            percentage,
            unfollowLog: [
              ...prevState.unfollowLog,
              { user, unfollowedSuccessfully: success },
            ],
          };
        });

        actionsSinceSave += 1;
        if (actionsSinceSave >= SAVE_EVERY_N_ACTIONS) {
          await persistRemaining(state, startedAt, i + 1);
          actionsSinceSave = 0;
        }

        if (user === state.selectedResults[state.selectedResults.length - 1]) {
          break;
        }
        await limiter.wait();

        if (counter % 5 === 0) {
          setToast({
            show: true,
            text: `Sleeping ${timings.timeToWaitAfterFiveUnfollows / 60000} minutes to prevent getting temp blocked`,
          });
          await sleep(timings.timeToWaitAfterFiveUnfollows);
        }
        setToast({ show: false });
      }
      await clearPendingQueue();
    };
    void unfollow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);
}
