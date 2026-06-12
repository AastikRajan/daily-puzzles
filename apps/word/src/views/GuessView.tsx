import { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { utcDateString } from '@daily-logic/engine';
import {
  generateGuessPuzzle,
  isValidGuessWord,
  scoreGuess,
  getKeyStates,
  buildGuessShare,
  type GuessResult,
  type LetterState,
} from '@daily-logic/word-engine';
import { useUi } from '../state/ui';
import { useProgress, modeStreak } from '../state/progress';
import { useSettings } from '../state/settings';
import { load, save } from '../lib/storage';
import { shareText } from '../lib/share';
import * as haptics from '../lib/haptics';
import './guess.css';

const QWERTY = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['Enter','z','x','c','v','b','n','m','⌫'],
];

interface SavedGuessState {
  guesses: GuessResult[];
  currentInput: string;
  completed: boolean;
  won: boolean;
  startTime: number;
  elapsedMs: number;
}

function TileRow({ result, shake }: { result?: GuessResult; shake?: boolean; current?: string; active?: boolean }) {
  return null; // handled inline
}

function letterStateClass(s: LetterState | undefined): string {
  if (!s || s === 'unknown') return '';
  return `letter-${s}`;
}

export default function GuessView() {
  const go = useUi((s) => s.go);
  const date = useUi((s) => s.date);
  const recordCompletion = useProgress((s) => s.recordCompletion);
  const completions = useProgress((s) => s.completions);
  const { reducedMotion } = useSettings();

  const puzzle = generateGuessPuzzle(date);
  const storageKey = `guess:${date}`;

  const [state, setState] = useState<SavedGuessState>(() =>
    load<SavedGuessState | null>(storageKey, null) ?? {
      guesses: [],
      currentInput: '',
      completed: false,
      won: false,
      startTime: Date.now(),
      elapsedMs: 0,
    }
  );

  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState('');
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');

  // Timer
  useEffect(() => {
    if (state.completed) return;
    const id = setInterval(() => {
      setState((s) => s.completed ? s : { ...s, elapsedMs: Date.now() - s.startTime });
    }, 1000);
    return () => clearInterval(id);
  }, [state.completed]);

  // Persist
  useEffect(() => {
    save(storageKey, state);
  }, [state, storageKey]);

  const keyStates = getKeyStates(state.guesses);

  const showMessage = useCallback((msg: string, duration = 1800) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), duration);
  }, []);

  const submitGuess = useCallback(() => {
    if (state.completed) return;
    const word = state.currentInput.toLowerCase();
    if (word.length !== 5) {
      showMessage('Not enough letters');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      haptics.error();
      return;
    }
    if (!isValidGuessWord(word)) {
      showMessage('Not in word list');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      haptics.error();
      return;
    }

    const states = scoreGuess(word, puzzle.answer);
    const result: GuessResult = { word, states };
    const newGuesses = [...state.guesses, result];
    const won = states.every((s) => s === 'correct');
    const lost = !won && newGuesses.length >= puzzle.maxGuesses;
    const completed = won || lost;

    const rowIdx = newGuesses.length - 1;
    setRevealRow(rowIdx);
    setTimeout(() => setRevealRow(null), 1800);

    setState((s) => ({
      ...s,
      guesses: newGuesses,
      currentInput: '',
      completed,
      won,
      elapsedMs: s.elapsedMs,
    }));

    if (completed) {
      const elapsedMs = Date.now() - state.startTime;
      setTimeout(() => {
        recordCompletion(date, 'guess', {
          timeMs: elapsedMs,
          completedAt: Date.now(),
          attempts: newGuesses.length,
          won,
        });
        if (won) {
          haptics.win();
          if (!reducedMotion) {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.5 },
              colors: ['#14b8a6', '#22d3ee', '#fff', '#f59e0b'],
            });
          }
        } else {
          showMessage(puzzle.answer.toUpperCase(), 3000);
        }
      }, 1600);
    } else {
      haptics.tap();
    }
  }, [state, puzzle, date, recordCompletion, reducedMotion, showMessage]);

  const handleKey = useCallback((key: string) => {
    if (state.completed) return;
    if (key === 'Enter') {
      submitGuess();
    } else if (key === '⌫' || key === 'Backspace') {
      setState((s) => ({ ...s, currentInput: s.currentInput.slice(0, -1) }));
    } else if (/^[a-zA-Z]$/.test(key) && state.currentInput.length < 5) {
      setState((s) => ({ ...s, currentInput: s.currentInput + key.toUpperCase() }));
    }
  }, [state.completed, state.currentInput, submitGuess]);

  // Physical keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      handleKey(e.key === 'Backspace' ? '⌫' : e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleKey]);

  const streak = modeStreak(completions, 'guess', utcDateString());
  const shareText_ = state.completed
    ? buildGuessShare(date, state.guesses, state.won, streak)
    : '';

  const onShare = async () => {
    const result = await shareText(shareText_);
    if (result !== 'failed') setShareState(result as 'copied' | 'shared');
  };

  // Render
  const allRows: Array<{ result?: GuessResult; current?: string; empty?: true }> = [];
  for (let i = 0; i < puzzle.maxGuesses; i++) {
    if (i < state.guesses.length) allRows.push({ result: state.guesses[i] });
    else if (i === state.guesses.length && !state.completed) allRows.push({ current: state.currentInput });
    else allRows.push({ empty: true });
  }

  return (
    <div className="view guess-view">
      <header className="pz-header">
        <button className="pz-back" onClick={() => go('home')} aria-label="Back" data-testid="back-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <div className="pz-title">
          <span className="pz-name">Guess</span>
          <span className="pz-sub" style={{ color: 'var(--c-guess)' }}>Wordle-style</span>
        </div>
      </header>

      {message && (
        <div className="guess-message" role="alert" data-testid="guess-message">{message}</div>
      )}

      <div className="guess-grid" data-testid="guess-grid">
        {allRows.map((row, rowIdx) => {
          const isCurrent = !state.completed && rowIdx === state.guesses.length;
          const isRevealing = revealRow === rowIdx;
          const shakeThis = shake && isCurrent;

          return (
            <div
              key={rowIdx}
              className={`guess-row${shakeThis ? ' shake' : ''}`}
              data-testid={`guess-row-${rowIdx}`}
            >
              {Array.from({ length: 5 }).map((_, colIdx) => {
                let letter = '';
                let stateClass = '';
                let revealDelay = '';

                if (row.result) {
                  letter = row.result.word[colIdx]?.toUpperCase() ?? '';
                  const ls = row.result.states[colIdx];
                  stateClass = letterStateClass(ls);
                  if (isRevealing) {
                    revealDelay = `animation-delay: ${colIdx * 250}ms`;
                  }
                } else if (row.current !== undefined) {
                  letter = row.current[colIdx] ?? '';
                }

                return (
                  <div
                    key={colIdx}
                    className={`guess-tile${letter ? ' filled' : ''}${stateClass ? ' ' + stateClass : ''}${isRevealing ? ' reveal' : ''}`}
                    style={revealDelay ? { animationDelay: `${colIdx * 250}ms` } : undefined}
                    data-testid={`tile-${rowIdx}-${colIdx}`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {state.completed && (
        <div className="win-overlay" data-testid="win-overlay">
          <div className="win-card" style={{ '--accent-grad': 'var(--g-guess)', '--accent': 'var(--c-guess)' } as React.CSSProperties}>
            <span className="win-burst" aria-hidden>
              <svg width="54" height="54" viewBox="0 0 54 54">
                <circle cx="27" cy="27" r="26" fill="var(--c-guess-soft)" />
                <path d={state.won ? "M17 28l7 7 13-15" : "M19 19l16 16M35 19L19 35"} stroke="var(--c-guess)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="win-title">{state.won ? 'Solved!' : 'Game Over'}</h2>
            <p className="win-sub">The word was <strong>{puzzle.answer.toUpperCase()}</strong></p>
            <div className="win-stats">
              <div className="win-stats-row">
                <div><dt>Guesses</dt><dd>{state.won ? `${state.guesses.length}/6` : 'X/6'}</dd></div>
                <div><dt>Streak</dt><dd>{streak}</dd></div>
                <div><dt>Result</dt><dd>{state.won ? '✓' : '✗'}</dd></div>
              </div>
            </div>
            <div className="win-actions">
              <button
                className="btn3d"
                style={{ '--btn': 'var(--c-guess)', '--btn-deep': 'var(--c-guess-deep)' } as React.CSSProperties}
                onClick={onShare}
                data-testid="win-share"
              >
                {shareState === 'idle' ? 'Share' : shareState === 'copied' ? 'Copied!' : 'Shared!'}
              </button>
              <button className="btn3d ghost" onClick={() => go('home')} data-testid="win-home">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="keyboard" data-testid="keyboard">
        {QWERTY.map((row, ri) => (
          <div key={ri} className="kb-row">
            {row.map((key) => {
              const ls = keyStates[key.toLowerCase()];
              return (
                <button
                  key={key}
                  className={`kb-key${key.length > 1 ? ' wide' : ''}${ls ? ' key-' + ls : ''}`}
                  onClick={() => handleKey(key)}
                  data-testid={`key-${key}`}
                  aria-label={key}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// suppress unused import
void TileRow;
