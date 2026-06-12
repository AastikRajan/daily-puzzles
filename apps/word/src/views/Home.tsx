import { useEffect, useState } from 'react';
import { msUntilNextPuzzle, utcDateString } from '@daily-logic/engine';
import { useUi } from '../state/ui';
import { useProgress, isCompleted, completionOf, modeStreak } from '../state/progress';
import type { WordMode } from '../state/progress';
import { formatDate, formatCountdown, formatTime } from '../lib/time';
import './home.css';

interface ModeMeta {
  mode: WordMode;
  name: string;
  tagline: string;
  accent: string;
  accentDeep: string;
  accentSoft: string;
  grad: string;
  emoji: string;
}

const MODES: ModeMeta[] = [
  {
    mode: 'guess',
    name: 'Guess',
    tagline: '6 tries to find the word',
    accent: 'var(--c-guess)',
    accentDeep: 'var(--c-guess-deep)',
    accentSoft: 'var(--c-guess-soft)',
    grad: 'var(--g-guess)',
    emoji: '?',
  },
  {
    mode: 'anagrams',
    name: 'Anagrams',
    tagline: 'Unscramble the rack',
    accent: 'var(--c-anagrams)',
    accentDeep: 'var(--c-anagrams-deep)',
    accentSoft: 'var(--c-anagrams-soft)',
    grad: 'var(--g-anagrams)',
    emoji: 'A',
  },
  {
    mode: 'hunt',
    name: 'Word Hunt',
    tagline: 'Find 6 hidden words',
    accent: 'var(--c-hunt)',
    accentDeep: 'var(--c-hunt-deep)',
    accentSoft: 'var(--c-hunt-soft)',
    grad: 'var(--g-hunt)',
    emoji: '⬡',
  },
];

function Card({ meta, date }: { meta: ModeMeta; date: string }) {
  const openMode = useUi((s) => s.openMode);
  const completions = useProgress((s) => s.completions);
  const done = isCompleted(completions, date, meta.mode);
  const completion = completionOf(completions, date, meta.mode);
  const streak = modeStreak(completions, meta.mode, utcDateString());

  return (
    <button
      className={`card ${done ? 'done' : ''}`}
      style={{
        '--accent': meta.accent,
        '--accent-soft': meta.accentSoft,
        '--accent-grad': meta.grad,
      } as React.CSSProperties}
      onClick={() => openMode(meta.mode)}
      data-testid={`card-${meta.mode}`}
    >
      <span className="card-glyph" aria-hidden>{meta.emoji}</span>
      <span className="card-text">
        <span className="card-name">{meta.name}</span>
        <span className="card-sub">
          {done && completion ? (
            <>Solved · {formatTime(completion.timeMs)}</>
          ) : (
            meta.tagline
          )}
        </span>
      </span>
      <span className="card-side">
        {streak > 0 && (
          <span className="streak" aria-label={`${streak} day streak`}>
            <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden>
              <path d="M6 0C6.5 3 10 4.5 10 8.5A4.3 4.3 0 0 1 6 13 4.3 4.3 0 0 1 2 8.5C2 6.8 2.8 5.6 3.5 4.7 3.8 6 4.7 6.7 5.5 7 5 4.5 5.5 2 6 0z" fill="currentColor" />
            </svg>
            {streak}
          </span>
        )}
        {done ? (
          <span className="check" aria-label="completed">
            <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
              <circle cx="11" cy="11" r="10" fill="var(--accent)" />
              <path d="M6.5 11.5l3 3 6-6.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : (
          <span className="arrow" aria-hidden>›</span>
        )}
      </span>
    </button>
  );
}

export default function Home() {
  const date = useUi((s) => s.date);
  const go = useUi((s) => s.go);
  const setDate = useUi((s) => s.setDate);
  const today = utcDateString();

  const [countdown, setCountdown] = useState(msUntilNextPuzzle());
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(msUntilNextPuzzle());
      if (utcDateString() !== today) setDate(utcDateString());
    }, 1000);
    return () => clearInterval(id);
  }, [today, setDate]);

  return (
    <div className="view home">
      <header className="masthead">
        <div className="masthead-row">
          <span className="brand-mark" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 22 22">
              <text x="3" y="17" fontSize="16" fontWeight="900" fill="#fff" fontFamily="serif">W</text>
            </svg>
          </span>
          <nav className="masthead-nav">
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
        <p className="masthead-date">{formatDate(date)}</p>
        <h1 className="masthead-title">Daily Word</h1>
      </header>

      <main className="cards" aria-label="Today's puzzles">
        {MODES.map((m) => (
          <Card key={m.mode} meta={m} date={date} />
        ))}
      </main>

      <footer className="home-foot">
        <p data-testid="countdown">
          New puzzles in <strong>{formatCountdown(countdown)}</strong>
        </p>
      </footer>
    </div>
  );
}
