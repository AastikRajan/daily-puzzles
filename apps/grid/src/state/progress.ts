import { create } from 'zustand';
import type { GridPuzzleType } from '@daily-logic/grid-engine';
import { utcDateString } from '@daily-logic/engine';
import { load, save } from '../lib/storage';

export interface Completion {
  timeMs: number;
  mistakes: number;
  hintsUsed: number;
  completedAt: number;
}

/** key: `${date}.${type}` */
export type CompletionLog = Record<string, Completion>;

export const HINTS_PER_DAY = 3;

interface ProgressState {
  completions: CompletionLog;
  hintDate: string;
  hintsUsed: number;
  recordCompletion: (date: string, type: GridPuzzleType, c: Completion) => void;
  consumeHint: () => boolean;
  hintsLeft: () => number;
}

const storedLog = load<CompletionLog>('completions', {});
const storedHints = load<{ date: string; used: number }>('hints', { date: '', used: 0 });

export const useProgress = create<ProgressState>((set, get) => ({
  completions: storedLog,
  hintDate: storedHints.date,
  hintsUsed: storedHints.used,
  recordCompletion: (date, type, c) => {
    const completions = { ...get().completions, [`${date}.${type}`]: c };
    set({ completions });
    save('completions', completions);
  },
  consumeHint: () => {
    const today = utcDateString();
    let { hintDate, hintsUsed } = get();
    if (hintDate !== today) { hintDate = today; hintsUsed = 0; }
    if (hintsUsed >= HINTS_PER_DAY) return false;
    hintsUsed++;
    set({ hintDate, hintsUsed });
    save('hints', { date: hintDate, used: hintsUsed });
    return true;
  },
  hintsLeft: () => {
    const today = utcDateString();
    const { hintDate, hintsUsed } = get();
    return hintDate === today ? Math.max(0, HINTS_PER_DAY - hintsUsed) : HINTS_PER_DAY;
  },
}));

export function isCompleted(log: CompletionLog, date: string, type: GridPuzzleType): boolean {
  return `${date}.${type}` in log;
}

export function completionOf(
  log: CompletionLog,
  date: string,
  type: GridPuzzleType,
): Completion | undefined {
  return log[`${date}.${type}`];
}
