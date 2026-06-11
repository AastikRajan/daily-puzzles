import { useState } from 'react';
import { addDays, utcDateString } from '@daily-logic/engine';
import { useUi } from '../state/ui';
import { formatDate } from '../lib/time';
import './archive.css';

export default function Archive() {
  const go = useUi((s) => s.go);
  const setDate = useUi((s) => s.setDate);
  const [showPremium, setShowPremium] = useState(false);
  const today = utcDateString();
  const yesterday = addDays(today, -1);
  // a taste of the deeper archive, gated
  const older = Array.from({ length: 5 }, (_, i) => addDays(today, -(i + 2)));

  const open = (date: string) => {
    setDate(date);
    go('home');
  };

  return (
    <div className="view">
      <header className="pz-header">
        <button className="pz-back" onClick={() => go('home')} aria-label="Back" data-testid="back-home">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13.5 5l-6 6 6 6" />
          </svg>
        </button>
        <div className="pz-title">
          <span className="pz-name">Archive</span>
        </div>
      </header>

      <button className="arch-row" onClick={() => open(today)} data-testid="archive-today">
        <span>{formatDate(today)}</span>
        <span className="arch-tag">Today</span>
      </button>
      <button className="arch-row" onClick={() => open(yesterday)} data-testid="archive-yesterday">
        <span>{formatDate(yesterday)}</span>
        <span className="arch-tag">Free</span>
      </button>

      {older.map((d) => (
        <button key={d} className="arch-row locked" onClick={() => setShowPremium(true)} data-testid="archive-locked">
          <span>{formatDate(d)}</span>
          <span className="arch-lock" aria-label="Premium">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="7" width="10" height="7" rx="1.6" />
              <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
            </svg>
          </span>
        </button>
      ))}

      {showPremium && (
        <div className="win-overlay" role="dialog" aria-label="Premium" onClick={() => setShowPremium(false)}>
          <div className="win-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="win-title">Premium</h2>
            <p className="premium-copy">
              The full puzzle archive, two extra themes and more are coming soon as Daily Logic
              Premium.
            </p>
            <div className="win-actions">
              <button className="btn-primary" onClick={() => setShowPremium(false)} data-testid="premium-close">
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
