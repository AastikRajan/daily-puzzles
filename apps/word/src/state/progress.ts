import { create } from 'zustand';
import { load, save } from '../lib/storage';

export type WordMode = 'guess' | 'anagrams' | 'hunt';

export interface Completion {
  timeMs: number;
  completedAt: number;
  /** guess: number of attempts (1-6), 0 = failed */
  attempts?: number;
  /** guess: won or not */
  won?: boolean;
  /** anagrams: score */
  score?: number;
  /** anagrams: max possible score */
  maxScore?: number;
  /** hunt: number of words found */
  wordsFound?: number;
}

export type CompletionLog = Record<string, Completion>;

interface ProgressState {
  completions: CompletionLog;
  recordCompletion: (date: string, mode: WordMode, c: Completion) => void;
}

const stored = load<CompletionLog>('completions', {});

export const useProgress = create<ProgressState>((set, get) => ({
  completions: stored,
  recordCompletion: (date, mode, c) => {
    const completions = { ...get().completions, [`${date}.${mode}`]: c };
    set({ completions });
    save('completions', completions);
  },
}));

export function isCompleted(log: CompletionLog, date: string, mode: WordMode): boolean {
  return `${date}.${mode}` in log;
}

export function completionOf(
  log: CompletionLog,
  date: string,
  mode: WordMode,
): Completion | undefined {
  return log[`${date}.${mode}`];
}

export function modeStreak(log: CompletionLog, mode: WordMode, today: string): number {
  const addDaysFn = (d: string, n: number): string => {
    const date = new Date(`${d}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + n);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  let day = today;
  if (!(`${today}.${mode}` in log)) day = addDaysFn(today, -1);
  let n = 0;
  while (`${day}.${mode}` in log) {
    n++;
    day = addDaysFn(day, -1);
  }
  return n;
}
