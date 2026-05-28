import React from 'react';
import { useTranslation } from '../hooks/useTranslation';

interface NotSearchingProps {
  onScan?: () => void;
}

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

export const NotSearching = ({ onScan }: NotSearchingProps) => {
  const { t } = useTranslation();
  const copy = t.landing;
  return (
    <section className="launch-screen">
      <div className="launch-copy">
        <span className="eyebrow">{copy.eyebrow}</span>
        <h1>{copy.headline}</h1>
        <p>{copy.lede}</p>
        <div className="launch-actions">
          <button className="run-scan" onClick={onScan} type="button">
            {copy.cta}
            <ArrowIcon />
          </button>
          <span className="launch-note">{copy.note}</span>
        </div>
      </div>
      <div className="launch-panel" aria-hidden="true">
        <div className="scan-orbit">
          <span />
          <span />
          <span />
        </div>
        <div className="signal-card primary">
          <span>{copy.statusLabel}</span>
          <strong>{copy.statusValue}</strong>
        </div>
        <div className="signal-card">
          <span>{copy.whitelistLabel}</span>
          <strong>{copy.whitelistValue}</strong>
        </div>
        <div className="signal-card accent">
          <span>{copy.nextStepLabel}</span>
          <strong>{copy.nextStepValue}</strong>
        </div>
      </div>
    </section>
  );
};
