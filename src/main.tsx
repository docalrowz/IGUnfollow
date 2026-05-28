import React, { ChangeEvent, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.scss';

import { Typename, UserNode } from './model/user';
import { Toast } from './components/Toast';
import { UserCheckIcon } from './components/icons/UserCheckIcon';
import { UserUncheckIcon } from './components/icons/UserUncheckIcon';
import { DEFAULT_TIME_BETWEEN_SEARCH_CYCLES,
  DEFAULT_TIME_BETWEEN_UNFOLLOWS,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS, INSTAGRAM_HOSTNAME } from './constants/constants';
import { assertUnreachable } from './utils/utils';
import { getCurrentPageUnfollowers, getUsersForDisplay } from './state/selectors';
import { NotSearching } from './components/NotSearching';
import { State } from './model/state';
import { Searching } from './components/Searching';
import { Toolbar } from './components/Toolbar';
import { Unfollowing } from './components/Unfollowing';
import { Timings } from './model/timings';
import { loadWhitelist, saveWhitelist, loadTimings, saveTimings } from './utils/whitelist-manager';
import { DialogProvider, useConfirm } from './components/ui/ConfirmDialog';
import { TranslationProvider } from './i18n/TranslationProvider';
import { ThemeProvider } from './theme/ThemeProvider';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { InstagramError } from './core/error-types';
import { errorDetail, errorTitle } from './state/error-messages';
import { useScanner } from './hooks/useScanner';
import { useUnfollower } from './hooks/useUnfollower';
import { ToastState } from './hooks/api-error-handler';

const LOCAL_PREVIEW_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const isLocalPreview = LOCAL_PREVIEW_HOSTS.has(location.hostname);

const _avatarUrl = (seed: string): string =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0f172a,1f2937,312e81&fontFamily=Verdana`;

const _createPreviewUser = (
  id: string,
  username: string,
  fullName: string,
  options: { readonly isPrivate?: boolean; readonly isVerified?: boolean; readonly followsViewer?: boolean } = {},
): UserNode => ({
  id,
  username,
  full_name: fullName,
  profile_pic_url: _avatarUrl(username),
  is_private: options.isPrivate ?? false,
  is_verified: options.isVerified ?? false,
  followed_by_viewer: true,
  follows_viewer: options.followsViewer ?? false,
  requested_by_viewer: false,
  reel: {
    id,
    expiring_at: 0,
    has_pride_media: false,
    latest_reel_media: 0,
    seen: null,
    owner: {
      __typename: Typename.GraphUser,
      id,
      profile_pic_url: _avatarUrl(username),
      username,
    },
  },
});

const _getPreviewUsers = (): readonly UserNode[] => [
  _createPreviewUser('1', 'alina.frames', 'Alina Moreno', { isVerified: true }),
  _createPreviewUser('2', 'brassandbone', 'Theo Walsh', { isPrivate: true }),
  _createPreviewUser('3', 'citrus.archive', 'Mara Kim', { followsViewer: true }),
  _createPreviewUser('4', 'dawnledger', 'Jon Bell', { isPrivate: true }),
  _createPreviewUser('5', 'elias.market', 'Elias Noor', { isVerified: true }),
  _createPreviewUser('6', 'fieldnotes.studio', 'Nadia Reyes'),
  _createPreviewUser('7', 'glint.supply', 'Remy Park', { followsViewer: true }),
  _createPreviewUser('8', 'harbor.sequence', 'Ivy Chen', { isPrivate: true }),
  _createPreviewUser('9', 'inkline.daily', 'Sofia Grant'),
  _createPreviewUser('10', 'juniper.signal', 'Cal Reed', { isVerified: true }),
  _createPreviewUser('11', 'keystone.labs', 'Mina Torres'),
  _createPreviewUser('12', 'lowlight.club', 'Owen Voss', { isPrivate: true }),
];

interface ErrorScreenProps {
  readonly error: InstagramError;
  readonly recoverable: boolean;
  readonly onReset: () => void;
}

function ErrorScreen({ error, recoverable, onReset }: ErrorScreenProps) {
  return (
    <section className='error-screen' role='alert'>
      <h2>{errorTitle(error)}</h2>
      <p>{errorDetail(error)}</p>
      {recoverable
        ? <p>You can safely try again in a few moments.</p>
        : <p>Reload the page and verify your account on Instagram before retrying.</p>}
      <button type='button' onClick={onReset}>Back to start</button>
    </section>
  );
}


function App() {
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
        results: _getPreviewUsers(),
        selectedResults: _getPreviewUsers().slice(0, 3),
        whitelistedResults: _getPreviewUsers().slice(10, 12),
        paused: false,
        filter: {
          showNonFollowers: true,
          showFollowers: false,
          showVerified: true,
          showPrivate: true,
          showWithOutProfilePicture: true,
        },
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
      const previewUsers = _getPreviewUsers();
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
        filter: {
          showNonFollowers: true,
          showFollowers: false,
          showVerified: true,
          showPrivate: true,
          showWithOutProfilePicture: true,
        },
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
      filter: {
        showNonFollowers: true,
        showFollowers: false,
        showVerified: true,
        showPrivate: true,
        showWithOutProfilePicture: true,
      },
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
        // Force re-render so the checkbox UI snaps back to the underlying filter state.
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
      setState({
        ...state,
        selectedResults: [...state.selectedResults, user],
      });
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
    if (e.currentTarget.checked) {
      setState({
        ...state,
        selectedResults: getUsersForDisplay(
          state.results,
          state.whitelistedResults,
          state.currentTab,
          state.searchTerm,
          state.filter,
        ),
      });
    } else {
      setState({
        ...state,
        selectedResults: [],
      });
    }
  };

  const toggleCurrentPageUsers = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== 'scanning') {
      return;
    }
    if (e.currentTarget.checked) {
      setState({
        ...state,
        selectedResults: getCurrentPageUnfollowers(
          getUsersForDisplay(
            state.results,
            state.whitelistedResults,
            state.currentTab,
            state.searchTerm,
            state.filter,
          ),
          state.page,
        ),
      });
    } else {
      setState({
        ...state,
        selectedResults: [],
      });
    }
  };

  const onWhitelistUpdate = (updatedWhitelist: readonly UserNode[]) => {
    saveWhitelist(updatedWhitelist);
    setWhitelist(updatedWhitelist);
    if (state.status === 'scanning') {
      setState({
        ...state,
        whitelistedResults: updatedWhitelist,
      });
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

    case 'scanning': {
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
    }

    case 'unfollowing':
      markup = <Unfollowing
        state={state}
        handleUnfollowFilter={handleUnfollowFilter}
       />;
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

if (location.hostname !== INSTAGRAM_HOSTNAME && !isLocalPreview) {
  // Native alert() pre-render is blocking + jarring. Show a styled
  // overlay instead. No React: DialogProvider would not yet be mounted.
  renderHostnameError();
} else {
  document.title = 'InstagramUnfollowers';
  // Mount inside our own root div instead of stomping on document.body.
  // Instagram occasionally re-injects body content; isolating our tree
  // means our React state survives that.
  const existing = document.getElementById('iu-root');
  if (existing !== null) {
    existing.remove();
  }
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.id = 'iu-root';
  document.body.appendChild(root);
  createRoot(root).render(
    <ErrorBoundary>
      <ThemeProvider>
        <TranslationProvider>
          <DialogProvider>
            <App />
          </DialogProvider>
        </TranslationProvider>
      </ThemeProvider>
    </ErrorBoundary>,
  );
}

function renderHostnameError() {
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'alert');
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647',
    'background:rgba(0,0,0,0.92)', 'color:#efefef',
    'display:flex', 'flex-direction:column', 'align-items:center',
    'justify-content:center', 'padding:32px', 'gap:16px',
    'font-family:system-ui,sans-serif', 'font-size:15px',
  ].join(';');
  overlay.innerHTML = [
    '<h2 style="margin:0;font-size:22px;">InstagramUnfollowers</h2>',
    '<p style="max-width:520px;text-align:center;margin:0;line-height:1.5;color:#a3a3a3;">',
    'This script can only run on <strong>www.instagram.com</strong>.',
    ' Open Instagram in another tab and paste the script in the developer console there.',
    '</p>',
  ].join('');
  const close = document.createElement('button');
  close.textContent = 'Dismiss';
  close.style.cssText = [
    'padding:10px 20px', 'border-radius:8px', 'border:1px solid rgba(255,255,255,0.1)',
    'background:#2563eb', 'color:white', 'cursor:pointer', 'font-size:14px',
  ].join(';');
  close.addEventListener('click', () => overlay.remove());
  overlay.appendChild(close);
  document.body.appendChild(overlay);
}
