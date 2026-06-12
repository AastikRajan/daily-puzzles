import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { utcDateString } from '@daily-logic/engine';
import {
  generateHuntPuzzle,
  buildHuntShare,
  GRID_SIZE,
} from '@daily-logic/word-engine';
import { useUi } from '../state/ui';
import { useProgress, modeStreak } from '../state/progress';
import { useSettings } from '../state/settings';
import { load, save } from '../lib/storage';
import { shareText } from '../lib/share';
import { formatTime } from '../lib/time';
import * as haptics from '../lib/haptics';
import './hunt.css';

interface SavedHuntState {
  foundWords: string[];
  completed: boolean;
  startTime: number;
  elapsedMs: number;
}

interface Selection {
  start: { row: number; col: number } | null;
  end: { row: number; col: number } | null;
}

function straightLineCells(
  start: { row: number; col: number },
  end: { row: number; col: number },
): Array<{ row: number; col: number }> {
  const dr = end.row - start.row;
  const dc = end.col - start.col;
  const len = Math.max(Math.abs(dr), Math.abs(dc));
  if (len === 0) return [start];
  const rStep = dr === 0 ? 0 : dr / Math.abs(dr);
  const cStep = dc === 0 ? 0 : dc / Math.abs(dc);
  // Must be horizontal, vertical, or diagonal
  if (Math.abs(dr) !== 0 && Math.abs(dc) !== 0 && Math.abs(dr) !== Math.abs(dc)) return [];
  const cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i <= len; i++) {
    cells.push({ row: start.row + rStep * i, col: start.col + cStep * i });
  }
  return cells;
}

export default function HuntView() {
  const go = useUi((s) => s.go);
  const date = useUi((s) => s.date);
  const recordCompletion = useProgress((s) => s.recordCompletion);
  const completions = useProgress((s) => s.completions);
  const { reducedMotion } = useSettings();

  const puzzle = generateHuntPuzzle(date);
  const storageKey = `hunt:${date}`;

  const [state, setState] = useState<SavedHuntState>(() =>
    load<SavedHuntState | null>(storageKey, null) ?? {
      foundWords: [],
      completed: false,
      startTime: Date.now(),
      elapsedMs: 0,
    }
  );

  const [selection, setSelection] = useState<Selection>({ start: null, end: null });
  const [dragging, setDragging] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'shared'>('idle');
  const gridRef = useRef<HTMLDivElement>(null);

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

  const streak = modeStreak(completions, 'hunt', utcDateString());

  const selCells = selection.start && selection.end
    ? straightLineCells(selection.start, selection.end)
    : selection.start ? [selection.start] : [];

  const selectedWord = selCells.map((c) => puzzle.grid[c.row]?.[c.col] ?? '').join('').toLowerCase();

  const checkMatch = useCallback((cells: Array<{ row: number; col: number }>) => {
    const word = cells.map((c) => puzzle.grid[c.row]?.[c.col] ?? '').join('').toLowerCase();
    const reverseWord = [...word].reverse().join('');

    for (const pw of puzzle.words) {
      if (state.foundWords.includes(pw.word)) continue;
      const match = word === pw.word || reverseWord === pw.word;
      if (match) {
        haptics.win();
        const newFound = [...state.foundWords, pw.word];
        const completed = newFound.length >= puzzle.words.length;
        setState((s) => ({
          ...s,
          foundWords: newFound,
          completed,
        }));
        if (completed) {
          const elapsedMs = Date.now() - s.startTime;
          recordCompletion(date, 'hunt', {
            timeMs: elapsedMs,
            completedAt: Date.now(),
            wordsFound: newFound.length,
          });
          if (!reducedMotion) {
            confetti({
              particleCount: 100,
              spread: 80,
              origin: { y: 0.4 },
              colors: ['#6366f1', '#a78bfa', '#fff', '#22d3ee'],
            });
          }
        }
        return true;
      }
    }
    haptics.error();
    return false;
  }, [puzzle, state.foundWords, state.startTime, date, recordCompletion, reducedMotion]);

  const getCellFromEvent = (e: React.TouchEvent | React.MouseEvent): { row: number; col: number } | null => {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = 'touches' in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const cellW = rect.width / GRID_SIZE;
    const cellH = rect.height / GRID_SIZE;
    const col = Math.floor(x / cellW);
    const row = Math.floor(y / cellH);
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
    return { row, col };
  };

  const onStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (state.completed) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    setDragging(true);
    setSelection({ start: cell, end: cell });
  };

  const onMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragging || state.completed) return;
    const cell = getCellFromEvent(e);
    if (!cell) return;
    setSelection((s) => ({ ...s, end: cell }));
  };

  const onEnd = () => {
    if (!dragging) return;
    setDragging(false);
    if (selCells.length >= 3) {
      checkMatch(selCells);
    }
    setSelection({ start: null, end: null });
  };

  const foundCells = new Set<string>();
  for (const fw of state.foundWords) {
    const pw = puzzle.words.find((w) => w.word === fw);
    if (pw) {
      for (const c of pw.cells) foundCells.add(`${c.row},${c.col}`);
    }
  }

  const selSet = new Set(selCells.map((c) => `${c.row},${c.col}`));

  // Word color for found words
  const ACCENT_COLORS = ['var(--c-hunt)', 'var(--c-guess)', 'var(--c-anagrams)', '#f59e0b', '#8b5cf6', '#10b981'];
  const wordColorMap: Record<string, string> = {};
  state.foundWords.forEach((w, i) => {
    wordColorMap[w] = ACCENT_COLORS[i % ACCENT_COLORS.length]!;
  });

  const foundCellColor = (row: number, col: number): string | null => {
    for (const fw of state.foundWords) {
      const pw = puzzle.words.find((w) => w.word === fw);
      if (pw && pw.cells.some((c) => c.row === row && c.col === col)) {
        return wordColorMap[fw] ?? null;
      }
    }
    return null;
  };

  const onShare = async () => {
    const text = buildHuntShare(date, state.elapsedMs, state.foundWords.length, streak);
    const result = await shareText(text);
    if (result !== 'failed') setShareState(result as 'copied' | 'shared');
  };

  // need local s reference for startTime in checkMatch callback
  const s = state;
  void s;

  return (
    <div className="view hunt-view">
      <header className="pz-header">
        <button className="pz-back" onClick={() => go('home')} aria-label="Back" data-testid="back-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 4l-6 6 6 6" />
          </svg>
        </button>
        <div className="pz-title">
          <span className="pz-name">Word Hunt</span>
          <span className="pz-sub" style={{ color: 'var(--c-hunt)' }}>
            {state.foundWords.length}/{puzzle.words.length} · {formatTime(state.elapsedMs)}
          </span>
        </div>
      </header>

      {/* Word list */}
      <div className="hunt-words" data-testid="hunt-words">
        {puzzle.words.map((pw) => {
          const found = state.foundWords.includes(pw.word);
          return (
            <span
              key={pw.word}
              className={`hunt-word${found ? ' found' : ''}`}
              style={found ? { borderColor: wordColorMap[pw.word], color: wordColorMap[pw.word], background: `${wordColorMap[pw.word]}22` } : undefined}
              data-testid={`word-${pw.word}`}
            >
              {found ? pw.word.toUpperCase() : '·'.repeat(pw.word.length)}
            </span>
          );
        })}
      </div>

      {/* Grid */}
      <div
        className="hunt-grid"
        ref={gridRef}
        data-testid="hunt-grid"
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        style={{ touchAction: 'none' }}
      >
        {puzzle.grid.map((row, rowIdx) =>
          row.map((letter, colIdx) => {
            const key = `${rowIdx},${colIdx}`;
            const isSel = selSet.has(key);
            const fc = foundCellColor(rowIdx, colIdx);
            return (
              <div
                key={key}
                className={`hunt-cell${isSel ? ' selecting' : ''}${fc ? ' found' : ''}`}
                style={fc ? { background: `${fc}33`, color: fc, borderColor: `${fc}66` } : undefined}
                data-testid={`cell-${rowIdx}-${colIdx}`}
              >
                {letter}
              </div>
            );
          })
        )}
      </div>

      {/* Currently selecting word display */}
      {dragging && selCells.length > 0 && (
        <div className="selecting-word" aria-live="polite">
          {selectedWord.toUpperCase()}
        </div>
      )}

      {state.completed && (
        <div className="win-overlay" data-testid="win-overlay">
          <div className="win-card" style={{ '--accent-grad': 'var(--g-hunt)', '--accent': 'var(--c-hunt)' } as React.CSSProperties}>
            <span className="win-burst" aria-hidden>
              <svg width="54" height="54" viewBox="0 0 54 54">
                <circle cx="27" cy="27" r="26" fill="var(--c-hunt-soft)" />
                <path d="M17 28l7 7 13-15" stroke="var(--c-hunt)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="win-title">Found 'em!</h2>
            <p className="win-sub">All {puzzle.words.length} words discovered</p>
            <div className="win-stats">
              <div className="win-stats-row">
                <div><dt>Time</dt><dd>{formatTime(state.elapsedMs)}</dd></div>
                <div><dt>Words</dt><dd>{state.foundWords.length}</dd></div>
                <div><dt>Streak</dt><dd>{streak}</dd></div>
              </div>
            </div>
            <div className="win-actions">
              <button
                className="btn3d"
                style={{ '--btn': 'var(--c-hunt)', '--btn-deep': 'var(--c-hunt-deep)' } as React.CSSProperties}
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
