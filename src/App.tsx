import React, { ChangeEvent, useEffect, useState } from 'react';

import { UserNode } from './model/user';
import { Toast } from './components/Toast';
import { UserCheckIcon } from './components/icons/UserCheckIcon';
import { UserUncheckIcon } from './components/icons/UserUncheckIcon';
import {
  DEFAULT_TIME_BETWEEN_SEARCH_CYCLES,
  DEFAULT_TIME_BETWEEN_UNFOLLOWS,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS,
} from './constants/constants';
import { assertUnreachable } from './utils/utils';
import { getCurrentPageUnfollowers, getUsersForDisplay } from './state/selectors';
import { NotSearching } from './components/NotSearching';
import { State } from './model/state';
import { Searching } from './components/Searching';
import { Toolbar } from './components/Toolbar';
import { Unfollowing } from './components/Unfollowing';
import { Timings } from './model/timings';
import { loadWhitelist, saveWhitelist, loadTimings, saveTimings } from './utils/whitelist-manager';
import { useConfirm } from './components/ui/ConfirmDialog';
import { ErrorScreen } from './components/ErrorScreen';
import { useScanner } from './hooks/useScanner';
import { useUnfollower } from './hooks/useUnfollower';
import { ToastState } from './hooks/api-error-handler';
import { getPreviewUsers, isLocalPreview } from './preview/preview-users';

const PREVIEW_FILTER = {
  showNonFollowers: true,
  showFollowers: false,
  showVerified: true,
  showPrivate: true,
  showWithOutProfilePicture: true,
} as const;

export function App() {
  const askConfirm = useConfirm();

  const [whitelist, setWhitelist] = useState<readonly UserNode[]>(() => loadWhitelist());

  const [state, setState] = useState<State>(() => (
    isLocalPreview && new URLSearchParams(location.search).get('preview') === 'scanning'
      ? {
        status: 'scanning',
        page: 1,
        searchTerm: '',
        currentTab: 'non_whitelisted',
        percentage: 100,
        results: getPreviewUsers(),
        selectedResults: getPreviewUsers().slice(0, 3),
        whitelistedResults: getPreviewUsers().slice(10, 12),
        paused: false,
        filter: { ...PREVIEW_FILTER },
      }
      : { status: 'initial' }
  ));

  const [toast, setToast] = useState<ToastState>({ show: false });

  const [timings, setTimings] = useState<Timings>(() => loadTimings() ?? {
    timeBetweenSearchCycles: DEFAULT_TIME_BETWEEN_SEARCH_CYCLES,
    timeToWaitAfterFiveSearchCycles: DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES,
    timeBetweenUnfollows: DEFAULT_TIME_BETWEEN_UNFOLLOWS,
    timeToWaitAfterFiveUnfollows: DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS,
  });

  useEffect(() => {
    saveTimings(timings);
  }, [timings]);

  useScanner({ state, setState, setToast, timings, isLocalPreview });
  useUnfollower({
    state,
    setState,
    setToast,
    timings,
    isLocalPreview,
    confirm: message => askConfirm({
      title: 'Resume previous batch?',
      message,
      confirmLabel: 'Resume',
      cancelLabel: 'Discard',
    }),
  });

  let isActiveProcess: boolean;
  switch (state.status) {
    case 'initial':
    case 'error':
      isActiveProcess = false;
      break;
    case 'scanning':
    case 'unfollowing':
      isActiveProcess = state.percentage < 100;
      break;
    default:
      assertUnreachable(state);
  }

  const onScan = () => {
    if (state.status !== 'initial') {
      return;
    }
    if (isLocalPreview) {
      const previewUsers = getPreviewUsers();
      setState({
        status: 'scanning',
        page: 1,
        searchTerm: '',
        currentTab: 'non_whitelisted',
        percentage: 100,
        results: previewUsers,
        selectedResults: previewUsers.slice(0, 3),
        whitelistedResults: previewUsers.slice(10, 12),
        paused: false,
        filter: { ...PREVIEW_FILTER },
      });
      return;
    }
    setState({
      status: 'scanning',
      page: 1,
      searchTerm: '',
      currentTab: 'non_whitelisted',
      percentage: 0,
      results: [],
      selectedResults: [],
      whitelistedResults: whitelist,
      paused: false,
      filter: { ...PREVIEW_FILTER },
    });
  };

  const handleScanFilter = async (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== 'scanning') {
      return;
    }
    const fieldName = e.currentTarget.name;
    const checked = e.currentTarget.checked;
    if (state.selectedResults.length > 0) {
      const ok = await askConfirm({
        title: 'Change filter?',
        message: 'Changing filter options will clear selected users.',
        confirmLabel: 'Change filter',
      });
      if (!ok) {
        setState({ ...state });
        return;
      }
    }
    setState(prev => {
      if (prev.status !== 'scanning') {
        return prev;
      }
      return {
        ...prev,
        selectedResults: [],
        filter: { ...prev.filter, [fieldName]: checked },
      };
    });
  };

  const handleUnfollowFilter = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== 'unfollowing') {
      return;
    }
    setState({
      ...state,
      filter: {
        ...state.filter,
        [e.currentTarget.name]: e.currentTarget.checked,
      },
    });
  };

  const toggleUser = (newStatus: boolean, user: UserNode) => {
    if (state.status !== 'scanning') {
      return;
    }
    if (newStatus) {
      setState({ ...state, selectedResults: [...state.selectedResults, user] });
    } else {
      setState({
        ...state,
        selectedResults: state.selectedResults.filter(result => result.id !== user.id),
      });
    }
  };

  const toggleAllUsers = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== 'scanning') {
      return;
    }
    setState({
      ...state,
      selectedResults: e.currentTarget.checked
        ? getUsersForDisplay(
          state.results,
          state.whitelistedResults,
          state.currentTab,
          state.searchTerm,
          state.filter,
        )
        : [],
    });
  };

  const toggleCurrentPageUsers = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== 'scanning') {
      return;
    }
    setState({
      ...state,
      selectedResults: e.currentTarget.checked
        ? getCurrentPageUnfollowers(
          getUsersForDisplay(
            state.results,
            state.whitelistedResults,
            state.currentTab,
            state.searchTerm,
            state.filter,
          ),
          state.page,
        )
        : [],
    });
  };

  const onWhitelistUpdate = (updatedWhitelist: readonly UserNode[]) => {
    saveWhitelist(updatedWhitelist);
    setWhitelist(updatedWhitelist);
    if (state.status === 'scanning') {
      setState({ ...state, whitelistedResults: updatedWhitelist });
    }
  };

  const togglePause = () => {
    setState(prev => prev.status === 'scanning' ? { ...prev, paused: !prev.paused } : prev);
  };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isActiveProcess) {
        return;
      }
      e.returnValue = 'Changes you made may not be saved.';
      return 'Changes you made may not be saved.';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isActiveProcess]);

  let markup: React.JSX.Element;
  switch (state.status) {
    case 'initial':
      markup = <NotSearching onScan={onScan} />;
      break;
    case 'scanning':
      markup = <Searching
        state={state}
        handleScanFilter={handleScanFilter}
        toggleUser={toggleUser}
        pauseScan={togglePause}
        setState={setState}
        scanningPaused={state.paused}
        UserCheckIcon={UserCheckIcon}
        UserUncheckIcon={UserUncheckIcon}
       />;
      break;
    case 'unfollowing':
      markup = <Unfollowing state={state} handleUnfollowFilter={handleUnfollowFilter} />;
      break;
    case 'error':
      markup = (
        <ErrorScreen
          error={state.error}
          recoverable={state.recoverable}
          onReset={() => setState({ status: 'initial' })}
        />
      );
      break;
    default:
      assertUnreachable(state);
  }

  return (
    <main id='main' role='main' className='iu'>
      <section className='overlay'>
        <Toolbar
          state={state}
          setState={setState}
          isActiveProcess={isActiveProcess}
          toggleAllUsers={toggleAllUsers}
          toggleCurrentPageUsers={toggleCurrentPageUsers}
          setTimings={setTimings}
          currentTimings={timings}
          whitelistedUsers={whitelist}
          onWhitelistUpdate={onWhitelistUpdate}
         />

        {markup}

        {toast.show && <Toast show={toast.show} message={toast.text} onClose={() => setToast({ show: false })} />}
      </section>
    </main>
  );
}
