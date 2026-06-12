import type { GridPuzzleType } from '@daily-logic/grid-engine';
import type { Completion, CompletionLog } from '../state/progress';
import { TYPE_ORDER, TYPE_SQUARE } from './meta';
import { formatTime } from './time';

function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function performanceRow(type: GridPuzzleType, c: Completion): string {
  const squares = new Array<string>(5).fill(TYPE_SQUARE[type]);
  const mistakes = Math.min(c.mistakes, 5);
  for (let i = 0; i < mistakes; i++) squares[i] = '🟥';
  const hints = Math.min(c.hintsUsed, 5 - mistakes);
  for (let i = 0; i < hints; i++) squares[4 - i] = '⬜';
  return squares.join('');
}

export function buildPuzzleShare(
  type: GridPuzzleType,
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
  const names: Record<GridPuzzleType, string> = {
    queens: 'Queens', tango: 'Tango', zip: 'Zip',
  };
  return [
    `Daily Grid · ${names[type]} · ${shortDate(date)}`,
    `⏱️ ${formatTime(c.timeMs)}${streak > 1 ? ` · 🔥 ${streak}` : ''}`,
    `${performanceRow(type, c)} ${detail}`,
    'https://daily-grid.app',
  ].join('\n');
}

export function buildDailyShare(date: string, log: CompletionLog, allStreakDays: number): string {
  const row = TYPE_ORDER.map((t) => (log[`${date}.${t}`] ? TYPE_SQUARE[t] : '⬛')).join('');
  const done = TYPE_ORDER.filter((t) => log[`${date}.${t}`]).length;
  const totalMs = TYPE_ORDER.reduce((s, t) => s + (log[`${date}.${t}`]?.timeMs ?? 0), 0);
  const lines = [
    `Daily Grid · ${shortDate(date)}`,
    `${row} ${done}/3`,
    `⏱️ ${formatTime(totalMs)} total${allStreakDays > 1 ? ` · 🔥 ${allStreakDays} perfect days` : ''}`,
    'https://daily-grid.app',
  ];
  return lines.join('\n');
}

export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return 'failed';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
