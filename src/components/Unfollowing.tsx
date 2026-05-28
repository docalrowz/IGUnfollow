import React from 'react';
import { getUnfollowLogForDisplay } from '../state/selectors';
import { State } from '../model/state';
import { exportUnfollowLogToCSV, exportUnfollowLogToJSON } from '../utils/utils';
import { useTranslation } from '../hooks/useTranslation';

interface UnfollowingProps {
  state: State;
  handleUnfollowFilter: (e: React.ChangeEvent<HTMLInputElement>) => void;

}

export const Unfollowing = (
  {
    state,
    handleUnfollowFilter,
  }: UnfollowingProps) => {
  const { t } = useTranslation();

  if (state.status !== 'unfollowing') {
    return null;
  }

  const hasEntries = state.unfollowLog.length > 0;

  return (
    <section className='workspace-layout'>
      <aside className='app-sidebar'>
        <div className='panel-heading'>
          <span>{t.workspace.unfollowQueue}</span>
          <strong>{state.percentage}%</strong>
        </div>
        <menu className='flex column grow m-clear p-clear'>
          <p>{t.workspace.filter}</p>
          <label className='badge m-small'>
            <input
              type='checkbox'
              name='showSucceeded'
              checked={state.filter.showSucceeded}
              onChange={handleUnfollowFilter}
            />
            &nbsp;{t.workspace.succeeded}
          </label>
          <label className='badge m-small'>
            <input
              type='checkbox'
              name='showFailed'
              checked={state.filter.showFailed}
              onChange={handleUnfollowFilter}
            />
            &nbsp;{t.workspace.failed}
          </label>
        </menu>
        <div className='sidebar-buttons-grid'>
          <button
            className='button-secondary'
            type='button'
            disabled={!hasEntries}
            onClick={() => exportUnfollowLogToJSON(state.unfollowLog)}
          >
            JSON
          </button>
          <button
            className='button-secondary'
            type='button'
            disabled={!hasEntries}
            onClick={() => exportUnfollowLogToCSV(state.unfollowLog)}
          >
            CSV
          </button>
        </div>
      </aside>
      <article className='unfollow-log-container'>
        {state.unfollowLog.length === 0 && (
          <div className='empty-state'>
            <div className='empty-state-icon'>
              <svg viewBox='0 0 24 24' width='20' height='20' fill='none' stroke='currentColor' strokeWidth='1.75' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                <circle cx='12' cy='12' r='9' />
                <path d='M12 7v5l3 2' />
              </svg>
            </div>
            <h3>{t.states.queueStarting}</h3>
            <p>{t.states.queueStartingDescription}</p>
          </div>
        )}
        {state.unfollowLog.length > 0 && state.unfollowLog.length === state.selectedResults.length && (
          <>
            <hr />
            <div className='fs-large p-medium clr-green'>{t.workspace.allDone}</div>
            <hr />
          </>
        )}
        {getUnfollowLogForDisplay(state.unfollowLog, state.searchTerm, state.filter).map(
          (entry, index) =>
            entry.unfollowedSuccessfully ? (
              <div className='p-medium' key={entry.user.id}>
                Unfollowed
                <a
                  className='clr-inherit'
                  target='_blank'
                  href={`../${entry.user.username}`}
                  rel='noreferrer'
                >
                  &nbsp;{entry.user.username}
                </a>
                <span className='clr-cyan'>
                  &nbsp; [{index + 1}/{state.selectedResults.length}]
                </span>
              </div>
            ) : (
              <div className='p-medium clr-red' key={entry.user.id}>
                Failed to unfollow {entry.user.username} [{index + 1}/
                {state.selectedResults.length}]
              </div>
            ),
        )}
      </article>
    </section>
  );
};
