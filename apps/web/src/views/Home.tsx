import { useEffect, useState } from 'react';
import {
  difficultyForDate,
  msUntilNextPuzzle,
  utcDateString,
  type PuzzleType,
} from '@daily-logic/engine';
import { useUi } from '../state/ui';
import { useProgress, isCompleted, completionOf } from '../state/progress';
import { typeStreak, allStreak } from '../lib/streaks';
import { TYPE_META, TYPE_ORDER } from '../lib/meta';
import { formatDate, formatTime, formatCountdown } from '../lib/time';
import TypeGlyph from '../components/TypeGlyph';
import './home.css';

function DifficultyDots({ level }: { level: 'easy' | 'medium' | 'hard' }) {
  const n = level === 'easy' ? 1 : level === 'medium' ? 2 : 3;
  return (
    <span className="dots" aria-label={`difficulty ${level}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`dot ${i < n ? 'on' : ''}`} />
      ))}
    </span>
  );
}

function Card({ type, date }: { type: PuzzleType; date: string }) {
  const openPuzzle = useUi((s) => s.openPuzzle);
  const completions = useProgress((s) => s.completions);
  const meta = TYPE_META[type];
  const done = isCompleted(completions, date, type);
  const completion = completionOf(completions, date, type);
  const streak = typeStreak(completions, type, utcDateString());
  const difficulty = difficultyForDate(date);

  return (
    <button
      className={`card ${done ? 'done' : ''}`}
      style={{ '--accent': meta.accent, '--accent-soft': meta.accentSoft } as React.CSSProperties}
      onClick={() => openPuzzle(type, date)}
      data-testid={`card-${type}`}
    >
      <span className="card-glyph">
        <TypeGlyph type={type} />
      </span>
      <span className="card-text">
        <span className="card-name">{meta.name}</span>
        <span className="card-sub">
          {done && completion ? (
            <>
              Solved · {formatTime(completion.timeMs)}
            </>
          ) : (
            meta.tagline
          )}
        </span>
      </span>
      <span className="card-side">
        {streak > 0 && (
          <span className="streak" aria-label={`${streak} day streak`}>
            <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden>
              <path
                d="M6 0C6.5 3 10 4.5 10 8.5A4.3 4.3 0 0 1 6 13 4.3 4.3 0 0 1 2 8.5C2 6.8 2.8 5.6 3.5 4.7 3.8 6 4.7 6.7 5.5 7 5 4.5 5.5 2 6 0z"
                fill="currentColor"
              />
            </svg>
            {streak}
          </span>
        )}
        {done ? (
          <span className="check" aria-label="completed">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <circle cx="11" cy="11" r="10" fill="var(--accent)" />
              <path d="M6.5 11.5l3 3 6-6.5" stroke="var(--paper)" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : (
          <DifficultyDots level={difficulty} />
        )}
      </span>
    </button>
  );
}

export default function Home() {
  const date = useUi((s) => s.date);
  const go = useUi((s) => s.go);
  const setDate = useUi((s) => s.setDate);
  const completions = useProgress((s) => s.completions);
  const today = utcDateString();
  const streakAll = allStreak(completions, today);

  const [countdown, setCountdown] = useState(msUntilNextPuzzle());
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(msUntilNextPuzzle());
      // flip the board at midnight UTC
      if (utcDateString() !== today) setDate(utcDateString());
    }, 1000);
    return () => clearInterval(id);
  }, [today, setDate]);

  const viewingToday = date === today;

  return (
    <div className="view home">
      <header className="masthead">
        <div className="masthead-row">
          <span className="brand-mark" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 22 22">
              <rect x="1" y="1" width="9" height="9" rx="2.5" fill="currentColor" />
              <rect x="12" y="1" width="9" height="9" rx="2.5" fill="currentColor" opacity="0.35" />
              <rect x="1" y="12" width="9" height="9" rx="2.5" fill="currentColor" opacity="0.35" />
              <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.5" fill="currentColor" />
            </svg>
          </span>
          <nav className="masthead-nav">
            <button onClick={() => go('archive')} aria-label="Archive" data-testid="nav-archive">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="2.5" y="6" width="15" height="11" rx="2" />
                <path d="M5 6V4.5A1.5 1.5 0 0 1 6.5 3h7A1.5 1.5 0 0 1 15 4.5V6M7.5 10h5" />
              </svg>
            </button>
            <button onClick={() => go('stats')} aria-label="Statistics" data-testid="nav-stats">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M4 16.5v-6M10 16.5V3.5M16 16.5v-9" />
              </svg>
            </button>
            <button onClick={() => go('settings')} aria-label="Settings" data-testid="nav-settings">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <circle cx="10" cy="10" r="2.6" />
                <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M15.3 4.7l-1.6 1.6M6.3 13.7l-1.6 1.6" />
              </svg>
            </button>
          </nav>
        </div>
        <p className="masthead-date">{viewingToday ? formatDate(date) : `${formatDate(date)} — archive`}</p>
        <h1 className="masthead-title">Daily Logic</h1>
        {streakAll > 0 && viewingToday && (
          <p className="masthead-streak" data-testid="all-streak">
            Perfect-day streak: <strong>{streakAll}</strong>
          </p>
        )}
      </header>

      <main className="cards" aria-label="Today's puzzles">
        {TYPE_ORDER.map((t) => (
          <Card key={t} type={t} date={date} />
        ))}
      </main>

      <footer className="home-foot">
        {viewingToday ? (
          <p data-testid="countdown">
            New puzzles in <strong>{formatCountdown(countdown)}</strong>
          </p>
        ) : (
          <button className="back-to-today" onClick={() => setDate(today)}>
            ← Back to today
          </button>
        )}
      </footer>
    </div>
  );
}
