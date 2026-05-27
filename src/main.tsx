import React, { ChangeEvent, useEffect, useState } from "react";
import { render } from "react-dom";
import "./styles.scss";

import { Typename, UserNode } from "./model/user";
import { Toast } from "./components/Toast";
import { UserCheckIcon } from "./components/icons/UserCheckIcon";
import { UserUncheckIcon } from "./components/icons/UserUncheckIcon";
import { DEFAULT_TIME_BETWEEN_SEARCH_CYCLES,
  DEFAULT_TIME_BETWEEN_UNFOLLOWS,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS, INSTAGRAM_HOSTNAME } from "./constants/constants";
import { assertUnreachable } from "./utils/utils";
import { getCurrentPageUnfollowers, getUsersForDisplay } from "./state/selectors";
import { NotSearching } from "./components/NotSearching";
import { State } from "./model/state";
import { Searching } from "./components/Searching";
import { Toolbar } from "./components/Toolbar";
import { Unfollowing } from "./components/Unfollowing";
import { Timings } from "./model/timings";
import { loadWhitelist, saveWhitelist, loadTimings, saveTimings } from "./utils/whitelist-manager";
import { DialogProvider, useConfirm } from "./components/ui/ConfirmDialog";
import { InstagramError } from "./core/error-types";
import { useScanner } from "./hooks/useScanner";
import { useUnfollower } from "./hooks/useUnfollower";
import { ToastState } from "./hooks/api-error-handler";

const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
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
  _createPreviewUser("1", "alina.frames", "Alina Moreno", { isVerified: true }),
  _createPreviewUser("2", "brassandbone", "Theo Walsh", { isPrivate: true }),
  _createPreviewUser("3", "citrus.archive", "Mara Kim", { followsViewer: true }),
  _createPreviewUser("4", "dawnledger", "Jon Bell", { isPrivate: true }),
  _createPreviewUser("5", "elias.market", "Elias Noor", { isVerified: true }),
  _createPreviewUser("6", "fieldnotes.studio", "Nadia Reyes"),
  _createPreviewUser("7", "glint.supply", "Remy Park", { followsViewer: true }),
  _createPreviewUser("8", "harbor.sequence", "Ivy Chen", { isPrivate: true }),
  _createPreviewUser("9", "inkline.daily", "Sofia Grant"),
  _createPreviewUser("10", "juniper.signal", "Cal Reed", { isVerified: true }),
  _createPreviewUser("11", "keystone.labs", "Mina Torres"),
  _createPreviewUser("12", "lowlight.club", "Owen Voss", { isPrivate: true }),
];

interface ErrorScreenProps {
  readonly error: InstagramError;
  readonly recoverable: boolean;
  readonly onReset: () => void;
}

function ErrorScreen({ error, recoverable, onReset }: ErrorScreenProps) {
  return (
    <section className="error-screen" role="alert">
      <h2>{errorTitle(error)}</h2>
      <p>{errorDetail(error)}</p>
      {recoverable
        ? <p>You can safely try again in a few moments.</p>
        : <p>Reload the page and verify your account on Instagram before retrying.</p>}
      <button type="button" onClick={onReset}>Back to start</button>
    </section>
  );
}

function errorTitle(error: InstagramError): string {
  switch (error.kind) {
    case 'checkpoint':   return 'Instagram requires you to verify this account';
    case 'rate_limit':   return 'Rate-limited by Instagram';
    case 'csrf_expired': return 'Your Instagram session expired';
    case 'network':      return 'Network error';
    case 'unknown':      return 'Unexpected response from Instagram';
  }
}

function errorDetail(error: InstagramError): string {
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


function App() {
  const askConfirm = useConfirm();

  const [state, setState] = useState<State>(() => (
    isLocalPreview && new URLSearchParams(location.search).get("preview") === "scanning"
      ? {
        status: "scanning",
        page: 1,
        searchTerm: "",
        currentTab: "non_whitelisted",
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
      : { status: "initial" }
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
    case "initial":
    case "error":
      isActiveProcess = false;
      break;
    case "scanning":
    case "unfollowing":
      isActiveProcess = state.percentage < 100;
      break;
    default:
      assertUnreachable(state);
  }

  const onScan = async () => {
    if (state.status !== "initial") {
      return;
    }
    if (isLocalPreview) {
      const previewUsers = _getPreviewUsers();
      setState({
        status: "scanning",
        page: 1,
        searchTerm: "",
        currentTab: "non_whitelisted",
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
    const whitelistedResults = loadWhitelist();
    setState({
      status: "scanning",
      page: 1,
      searchTerm: "",
      currentTab: "non_whitelisted",
      percentage: 0,
      results: [],
      selectedResults: [],
      whitelistedResults,
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
    if (state.status !== "scanning") {
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
    if (state.status !== "unfollowing") {
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
    if (state.status !== "scanning") {
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
    if (state.status !== "scanning") {
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

  const toggleCurrentePageUsers = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== "scanning") {
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
    if (state.status === "scanning") {
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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      e = e || window.event;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (e) {
        e.returnValue = "Changes you made may not be saved.";
      }
      return "Changes you made may not be saved.";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isActiveProcess]);

  let markup: React.JSX.Element;
  switch (state.status) {
    case "initial":
      markup = <NotSearching onScan={onScan}></NotSearching>;
      break;

    case "scanning": {
      markup = <Searching
        state={state}
        handleScanFilter={handleScanFilter}
        toggleUser={toggleUser}
        pauseScan={togglePause}
        setState={setState}
        scanningPaused={state.paused}
        UserCheckIcon={UserCheckIcon}
        UserUncheckIcon={UserUncheckIcon}
      ></Searching>;
      break;
    }

    case "unfollowing":
      markup = <Unfollowing
        state={state}
        handleUnfollowFilter={handleUnfollowFilter}
      ></Unfollowing>;
      break;

    case "error":
      markup = (
        <ErrorScreen
          error={state.error}
          recoverable={state.recoverable}
          onReset={() => setState({ status: "initial" })}
        />
      );
      break;

    default:
      assertUnreachable(state);
  }

  return (
    <main id="main" role="main" className="iu">
      <section className="overlay">
        <Toolbar
          state={state}
          setState={setState}
          isActiveProcess={isActiveProcess}
          toggleAllUsers={toggleAllUsers}
          toggleCurrentePageUsers={toggleCurrentePageUsers}
          setTimings={setTimings}
          currentTimings={timings}
          whitelistedUsers={state.status === "scanning" ? state.whitelistedResults : loadWhitelist()}
          onWhitelistUpdate={onWhitelistUpdate}
        ></Toolbar>

        {markup}

        {toast.show && <Toast show={toast.show} message={toast.text} onClose={() => setToast({ show: false })} />}
      </section>
    </main>
  );
}

if (location.hostname !== INSTAGRAM_HOSTNAME && !isLocalPreview) {
  alert("Can be used only on Instagram routes");
} else {
  document.title = "InstagramUnfollowers";
  document.body.innerHTML = "";
  render(
    <DialogProvider>
      <App />
    </DialogProvider>,
    document.body,
  );
}
