import React, { ChangeEvent, useState } from 'react';
import { State } from '../model/state';
import { assertUnreachable, copyListToClipboard, exportToCSV, exportToJSON } from '../utils/utils';
import { getCurrentPageUnfollowers, getUsersForDisplay } from '../state/selectors';
import { SettingMenu } from './SettingMenu';
import { SettingIcon } from './icons/SettingIcon';
import { Timings } from '../model/timings';
import { Logo } from './icons/Logo';
import { UserNode } from '../model/user';
import { useAlert, useConfirm } from './ui/ConfirmDialog';

interface ToolBarProps {
  isActiveProcess: boolean;
  state: State;
  setState: (state: State) => void;
  toggleAllUsers: (e: ChangeEvent<HTMLInputElement>) => void;
  toggleCurrentePageUsers: (e: ChangeEvent<HTMLInputElement>) => void;
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
  toggleCurrentePageUsers,
  currentTimings,
  setTimings,
  whitelistedUsers,
  onWhitelistUpdate,
}: ToolBarProps) => {

  const [setingMenu, setSettingMenu] = useState(false);
  const askConfirm = useConfirm();
  const askAlert = useAlert();

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
          {
            state.status === 'initial' && <button className='icon-button' type='button' title='Settings'><SettingIcon onClickLogo={() => {
 setSettingMenu(true);
}} /></button>
          }
        </div>
        <div className='toolbar-search'>
          <input
            type='text'
            className='search-bar'
            placeholder='Search users'
            disabled={state.status === 'initial' || state.status === 'error'}
            value={(state.status === 'scanning' || state.status === 'unfollowing') ? state.searchTerm : ''}
            onChange={e => {
              switch (state.status) {
                case 'initial':
                case 'error':
                  return;
                case 'scanning':
                  return setState({
                    ...state,
                    searchTerm: e.currentTarget.value,
                  });
                case 'unfollowing':
                  return setState({
                    ...state,
                    searchTerm: e.currentTarget.value,
                  });
                default:
                  assertUnreachable(state);
              }
            }}
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
                onChange={toggleCurrentePageUsers}
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
      {(setingMenu) &&
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
