import React, { ChangeEvent, useEffect, useState } from 'react';
import { State } from '../model/state';
import { assertUnreachable, copyListToClipboard, exportToCSV, exportToJSON } from '../utils/utils';
import { getCurrentPageUnfollowers, getUsersForDisplay } from '../state/selectors';
import { SettingMenu } from './SettingMenu';
import { SettingIcon } from './icons/SettingIcon';
import { Timings } from '../model/timings';
import { Logo } from './icons/Logo';
import { UserNode } from '../model/user';
import { useAlert, useConfirm } from './ui/ConfirmDialog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../theme/ThemeProvider';
import { Locale } from '../i18n';

const SEARCH_DEBOUNCE_MS = 180;

const SunIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.75' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
    <circle cx='12' cy='12' r='4' />
    <path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.75' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
    <path d='M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z' />
  </svg>
);

interface ToolBarProps {
  isActiveProcess: boolean;
  state: State;
  setState: (state: State) => void;
  toggleAllUsers: (e: ChangeEvent<HTMLInputElement>) => void;
  toggleCurrentPageUsers: (e: ChangeEvent<HTMLInputElement>) => void;
  currentTimings: Timings;
  setTimings: (timings: Timings) => void;
  whitelistedUsers: readonly UserNode[];
  onWhitelistUpdate: (users: readonly UserNode[]) => void;
}

export const Toolbar = ({
  isActiveProcess,
  state,
  setState,
  toggleAllUsers,
  toggleCurrentPageUsers,
  currentTimings,
  setTimings,
  whitelistedUsers,
  onWhitelistUpdate,
}: ToolBarProps) => {

  const [settingMenu, setSettingMenu] = useState(false);
  const askConfirm = useConfirm();
  const askAlert = useAlert();
  const { t, locale, setLocale } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const nextLocale: Locale = locale === 'en' ? 'fr' : 'en';

  const externalSearchTerm =
    state.status === 'scanning' || state.status === 'unfollowing' ? state.searchTerm : '';
  const [searchInput, setSearchInput] = useState(externalSearchTerm);
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  // Sync the local input back from state when an outside change (tab
  // switch, scan reset) clears or replaces the active searchTerm.
  useEffect(() => {
    setSearchInput(externalSearchTerm);
  }, [externalSearchTerm]);

  // Propagate the debounced value into the global state machine. Each
  // status guards its own reducer so we never widen the discriminated
  // union accidentally.
  useEffect(() => {
    if (state.status !== 'scanning' && state.status !== 'unfollowing') {
      return;
    }
    if (debouncedSearch === state.searchTerm) {
      return;
    }
    setState({ ...state, searchTerm: debouncedSearch });
    // setState is stable from useState; intentionally narrow deps to
    // avoid re-running on every unrelated state mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <header className='app-header'>
      {isActiveProcess && (
        <div
          className='progressbar'
          style={{ '--progress-width': `${(state.status === 'scanning' || state.status === 'unfollowing') ? state.percentage : 0}%` } as React.CSSProperties}
        />
      )}
      <div className='app-header-content'>
        <div
          className='logo'
          onClick={() => {
            if (isActiveProcess) {
              // Avoid resetting state while active process.
              return;
            }
            void (async () => {
              switch (state.status) {
                case 'initial':
                  if (await askConfirm('Go back to Instagram?')) {
                    location.reload();
                  }
                  break;
                case 'scanning':
                case 'unfollowing':
                case 'error':
                  setState({ status: 'initial' });
              }
            })();
          }}
        >
          <Logo />
          <div className='logo-text'>
            <span>Instagram</span>
            <span>Unfollowers</span>
          </div>
        </div>
        <div className='toolbar-actions'>
          <button
            className='copy-list'
            onClick={() => {
              void (async () => {
                switch (state.status) {
                  case 'scanning':
                    await copyListToClipboard(
                      getUsersForDisplay(
                        state.results,
                        state.whitelistedResults,
                        state.currentTab,
                        state.searchTerm,
                        state.filter,
                      ),
                    );
                    await askAlert('List copied to clipboard.');
                    return;
                  case 'initial':
                  case 'unfollowing':
                  case 'error':
                    return;
                  default:
                    assertUnreachable(state);
                }
              })();
            }}
            disabled={state.status === 'initial' || state.status === 'error'}
          >
            Copy
          </button>
          <button
            className='copy-list'
            title='Export to JSON'
            onClick={() => {
              if (state.status === 'scanning') {
                exportToJSON(getUsersForDisplay(state.results, state.whitelistedResults, state.currentTab, state.searchTerm, state.filter));
              }
            }}
            disabled={state.status !== 'scanning'}
          >
            JSON
          </button>
          <button
            className='copy-list'
            title='Export to CSV'
            onClick={() => {
              if (state.status === 'scanning') {
                exportToCSV(getUsersForDisplay(state.results, state.whitelistedResults, state.currentTab, state.searchTerm, state.filter));
              }
            }}
            disabled={state.status !== 'scanning'}
          >
            CSV
          </button>
          <button
            className='icon-button'
            type='button'
            title={t.toolbar.toggleTheme}
            aria-label={t.toolbar.toggleTheme}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className='locale-toggle'
            type='button'
            title={t.toolbar.language}
            aria-label={`${t.toolbar.language}: ${nextLocale.toUpperCase()}`}
            onClick={() => setLocale(nextLocale)}
          >
            {locale.toUpperCase()}
          </button>
          {state.status === 'initial' && (
            <button className='icon-button' type='button' title={t.toolbar.settings} aria-label={t.toolbar.settings}>
              <SettingIcon onClickLogo={() => setSettingMenu(true)} />
            </button>
          )}
        </div>
        <div className='toolbar-search'>
          <input
            type='text'
            className='search-bar'
            placeholder={t.toolbar.searchPlaceholder}
            disabled={state.status === 'initial' || state.status === 'error'}
            value={searchInput}
            onChange={e => setSearchInput(e.currentTarget.value)}
          />
          {state.status === 'scanning' && (
            <label className='select-toggle'>
              <input
                title='Select all on this page'
                type='checkbox'
                // Avoid allowing selection while the scan is incomplete and the visible result set is still moving.
                disabled={state.percentage < 100}
                checked={
                  (() => {
                    const displayed = getUsersForDisplay(state.results, state.whitelistedResults, state.currentTab, state.searchTerm, state.filter);
                    const pageUsers = getCurrentPageUnfollowers(displayed, state.page);
                    return pageUsers.length > 0 && pageUsers.every(u => state.selectedResults.some(s => s.id === u.id));
                  })()
                }
                className='toggle-all-checkbox'
                onChange={toggleCurrentPageUsers}
              />
              Page
            </label>
          )}
          {state.status === 'scanning' && (
            <label className='select-toggle'>
              <input
                title='Select all'
                type='checkbox'
                // Avoid allowing selection while the scan is incomplete and the visible result set is still moving.
                disabled={state.percentage < 100}
                checked={
                  state.selectedResults.length ===
                  getUsersForDisplay(
                    state.results,
                    state.whitelistedResults,
                    state.currentTab,
                    state.searchTerm,
                    state.filter,
                  ).length
                }
                className='toggle-all-checkbox'
                onChange={toggleAllUsers}
              />
              All
            </label>
          )}
        </div>
      </div>
      {(settingMenu) &&
        <SettingMenu
          setSettingState={setSettingMenu}
          currentTimings={currentTimings}
          setTimings={setTimings}
          whitelistedUsers={whitelistedUsers}
          onWhitelistUpdate={onWhitelistUpdate}
         />
      }

    </header>
  );
};
