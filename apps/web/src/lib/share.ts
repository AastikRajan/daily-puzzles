import type { PuzzleType } from '@daily-logic/engine';
import type { Completion, CompletionLog } from '../state/progress';
import { TYPE_ORDER } from './meta';
import { formatTime } from './time';

/**
 * Spoiler-free share cards. No grid contents are ever revealed — the emoji
 * row encodes performance: each mistake burns a square to 🟥 (left→right),
 * each hint to 🟨 (right→left); what survives stays in the puzzle's color.
 */

export const TYPE_SQUARE: Record<PuzzleType, string> = {
  sudoku: '🟦',
  killer: '🟧',
  nonogram: '🟩',
  kakuro: '🟨',
  binairo: '🟪',
};

const TYPE_NAME: Record<PuzzleType, string> = {
  sudoku: 'Sudoku',
  killer: 'Killer Sudoku',
  nonogram: 'Nonogram',
  kakuro: 'Kakuro',
  binairo: 'Binairo',
};

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function performanceRow(type: PuzzleType, c: Completion): string {
  const squares = new Array<string>(5).fill(TYPE_SQUARE[type]);
  const mistakes = Math.min(c.mistakes, 5);
  for (let i = 0; i < mistakes; i++) squares[i] = '🟥';
  const hints = Math.min(c.hintsUsed, 5 - mistakes);
  for (let i = 0; i < hints; i++) squares[4 - i] = '⬜';
  return squares.join('');
}

export function buildPuzzleShare(
  type: PuzzleType,
  date: string,
  c: Completion,
  streak: number,
): string {
  const flawless = c.mistakes === 0 && c.hintsUsed === 0;
  const detail = flawless
    ? 'flawless'
    : [c.mistakes > 0 ? `${c.mistakes}✕` : '', c.hintsUsed > 0 ? `${c.hintsUsed}💡` : '']
        .filter(Boolean)
        .join(' ');
  return [
    `Daily Logic · ${TYPE_NAME[type]} · ${shortDate(date)}`,
    `⏱️ ${formatTime(c.timeMs)}${streak > 1 ? ` · 🔥 ${streak}` : ''}`,
    `${performanceRow(type, c)} ${detail}`,
    'https://daily-logic.app',
  ].join('\n');
}

export function buildDailyShare(date: string, log: CompletionLog, allStreakDays: number): string {
  const row = TYPE_ORDER.map((t) => (log[`${date}.${t}`] ? TYPE_SQUARE[t] : '⬛')).join('');
  const done = TYPE_ORDER.filter((t) => log[`${date}.${t}`]).length;
  const totalMs = TYPE_ORDER.reduce((s, t) => s + (log[`${date}.${t}`]?.timeMs ?? 0), 0);
  const lines = [
    `Daily Logic · ${shortDate(date)}`,
    `${row} ${done}/5`,
    `⏱️ ${formatTime(totalMs)} total${allStreakDays > 1 ? ` · 🔥 ${allStreakDays} perfect days` : ''}`,
    'https://daily-logic.app',
  ];
  return lines.join('\n');
}

/** Copy + native share sheet when available. Returns 'shared' | 'copied' | 'failed'. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed';
    // fall through to clipboard
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
