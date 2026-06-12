import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { utcDateString } from '@daily-logic/engine';
import {
  generateAnagramsPuzzle,
  getAnagramRank,
  buildAnagramShare,
} from '@daily-logic/word-engine';
import { useUi } from '../state/ui';
import { useProgress, modeStreak } from '../state/progress';
import { useSettings } from '../state/settings';
import { load, save } from '../lib/storage';
import { shareText } from '../lib/share';
import * as haptics from '../lib/haptics';
import './anagrams.css';

interface SavedAnagramState {
  found: string[];
  currentTiles: number[]; // indices into rack
  selectedIndices: number[];
  completed: boolean;
  score: number;
  startTime: number;
  elapsedMs: number;
}

export default function AnagramsView() {
  const go = useUi((s) => s.go);
  const date = useUi((s) => s.date);
  const recordCompletion = useProgress((s) => s.recordCompletion);
  const completions = useProgress((s) => s.completions);
  const { reducedMotion } = useSettings();

  const puzzle = generateAnagramsPuzzle(date);
  const storageKey = `anagrams:${date}`;

  const [state, setState] = useState<SavedAnagramState>(() =>
    load<SavedAnagramState | null>(storageKey, null) ?? {
      found: [],
      currentTiles: puzzle.rack.map((_, i) => i),
      selectedIndices: [],
      completed: false,
      score: 0,
      startTime: Date.now(),
      elapsedMs: 0,
    }
  );

  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');

  useEffect(() => {
    if (state.completed) return;
    const id = setInterval(() => {
      setState((s) => s.completed ? s : { ...s, elapsedMs: Date.now() - s.startTime });
    }, 1000);
    return () => clearInterval(id);
  }, [state.completed]);

  useEffect(() => {
    save(storageKey, state);
  }, [state, storageKey]);

  const showMessage = (msg: string, duration = 1500) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), duration);
  };

  const currentWord = state.selectedIndices.map((i) => puzzle.rack[i]!).join('').toLowerCase();
  const streak = modeStreak(completions, 'anagrams', utcDateString());

  const selectTile = (rackIdx: number) => {
    if (state.completed) return;
    if (state.selectedIndices.includes(rackIdx)) return;
    haptics.tap();
    setState((s) => ({ ...s, selectedIndices: [...s.selectedIndices, rackIdx] }));
  };

  const removeLast = () => {
    if (state.selectedIndices.length === 0) return;
    haptics.tap();
    setState((s) => ({ ...s, selectedIndices: s.selectedIndices.slice(0, -1) }));
  };

  const clearSelection = () => {
    setState((s) => ({ ...s, selectedIndices: [] }));
  };

  const submitWord = () => {
    if (state.completed || currentWord.length < 3) {
      if (currentWord.length < 3) showMessage('Too short! (min 3 letters)');
      return;
    }

    if (state.found.includes(currentWord)) {
      showMessage('Already found!');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      haptics.error();
      setState((s) => ({ ...s, selectedIndices: [] }));
      return;
    }

    if (!puzzle.solutions.includes(currentWord)) {
      showMessage('Not a valid word');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      haptics.error();
      setState((s) => ({ ...s, selectedIndices: [] }));
      return;
    }

    // Valid word found!
    haptics.win();
    const newFound = [...state.found, currentWord];
    const newScore = state.score + currentWord.length;
    const completed = newFound.length >= puzzle.solutions.length;

    setState((s) => ({
      ...s,
      found: newFound,
      selectedIndices: [],
      score: newScore,
      completed,
    }));

    showMessage(`+${currentWord.length} pts! ${currentWord.toUpperCase()}`);

    if (completed) {
      const elapsedMs = Date.now() - state.startTime;
      recordCompletion(date, 'anagrams', {
        timeMs: elapsedMs,
        completedAt: Date.now(),
        score: newScore,
        maxScore: puzzle.maxScore,
      });
      if (!reducedMotion) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.4 },
          colors: ['#fb7185', '#f97316', '#fff', '#fbbf24'],
        });
      }
    }
  };

  const rank = getAnagramRank(state.score, puzzle.maxScore);
  const rankPct = puzzle.maxScore > 0 ? Math.round((state.score / puzzle.maxScore) * 100) : 0;

  const onShare = async () => {
    const text = buildAnagramShare(
      date,
      state.score,
      puzzle.maxScore,
      state.found.length,
      puzzle.solutions.length,
      streak,
    );
    const result = await shareText(text);
    if (result !== 'failed') setShareState(result as 'copied' | 'shared');
  };

  const allSorted = [...puzzle.solutions].sort((a, b) => b.length - a.length);

  return (
    <div className="view anagrams-view">
      <header className="pz-header">
        <button className="pz-back" onClick={() => go('home')} aria-label="Back" data-testid="back-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <div className="pz-title">
          <span className="pz-name">Anagrams</span>
          <span className="pz-sub" style={{ color: 'var(--c-anagrams)' }}>
            {state.found.length}/{puzzle.solutions.length} · {state.score} pts
          </span>
        </div>
      </header>

      {message && <div className="anagrams-message" role="alert">{message}</div>}

      {/* Rank bar */}
      <div className="rank-bar" data-testid="rank-bar">
        <div className="rank-fill" style={{ width: `${Math.min(rankPct, 100)}%` }} />
        <span className="rank-label">{rank} ({rankPct}%)</span>
      </div>

      {/* Input display */}
      <div className={`anagram-input${shake ? ' shake' : ''}`} data-testid="anagram-input">
        {currentWord.length > 0 ? (
          <span className="input-word">{currentWord.toUpperCase()}</span>
        ) : (
          <span className="input-placeholder">Tap tiles to build a word</span>
        )}
      </div>

      {/* Rack tiles */}
      <div className="rack" data-testid="rack">
        {puzzle.rack.map((letter, i) => {
          const selected = state.selectedIndices.includes(i);
          const selOrder = state.selectedIndices.indexOf(i);
          return (
            <button
              key={i}
              className={`rack-tile${selected ? ' selected' : ''}`}
              onClick={() => selectTile(i)}
              disabled={selected || state.completed}
              data-testid={`rack-tile-${i}`}
              aria-label={letter}
            >
              {letter.toUpperCase()}
              {selected && <span className="tile-order">{selOrder + 1}</span>}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="anagram-controls">
        <button className="btn3d ghost" onClick={clearSelection} disabled={state.selectedIndices.length === 0}>
          Clear
        </button>
        <button className="btn3d ghost" onClick={removeLast} disabled={state.selectedIndices.length === 0}>
          ⌫
        </button>
        <button
          className="btn3d"
          style={{ '--btn': 'var(--c-anagrams)', '--btn-deep': 'var(--c-anagrams-deep)' } as React.CSSProperties}
          onClick={submitWord}
          disabled={currentWord.length < 3 || state.completed}
          data-testid="submit-word"
        >
          Submit
        </button>
      </div>

      {/* Found words */}
      <div className="found-words" data-testid="found-words">
        <p className="found-label">Found words</p>
        <div className="found-grid">
          {allSorted.map((word) => {
            const isFound = state.found.includes(word);
            return (
              <span key={word} className={`found-word${isFound ? ' found' : ''}`}>
                {isFound ? word.toUpperCase() : '·'.repeat(word.length)}
              </span>
            );
          })}
        </div>
      </div>

      {state.completed && (
        <div className="win-overlay" data-testid="win-overlay">
          <div className="win-card" style={{ '--accent-grad': 'var(--g-anagrams)', '--accent': 'var(--c-anagrams)' } as React.CSSProperties}>
            <span className="win-burst" aria-hidden>
              <svg width="54" height="54" viewBox="0 0 54 54">
                <circle cx="27" cy="27" r="26" fill="var(--c-anagrams-soft)" />
                <text x="14" y="35" fontSize="26" fill="var(--c-anagrams)">🧠</text>
              </svg>
            </span>
            <h2 className="win-title">{rank}!</h2>
            <p className="win-sub">All {puzzle.solutions.length} words found!</p>
            <div className="win-stats">
              <div className="win-stats-row">
                <div><dt>Score</dt><dd>{state.score}</dd></div>
                <div><dt>Words</dt><dd>{state.found.length}</dd></div>
                <div><dt>Streak</dt><dd>{streak}</dd></div>
              </div>
            </div>
            <div className="win-actions">
              <button
                className="btn3d"
                style={{ '--btn': 'var(--c-anagrams)', '--btn-deep': 'var(--c-anagrams-deep)' } as React.CSSProperties}
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
    </div>
  );
}
