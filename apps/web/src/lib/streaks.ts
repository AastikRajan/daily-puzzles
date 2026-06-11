import type { PuzzleType } from '@daily-logic/engine';
import { addDays } from '@daily-logic/engine';
import type { CompletionLog } from '../state/progress';
import { TYPE_ORDER } from './meta';

/**
 * Streak = consecutive days ending today (or yesterday, when today's puzzle
 * isn't finished yet — the streak isn't broken until the day actually ends).
 */
export function typeStreak(log: CompletionLog, type: PuzzleType, today: string): number {
  let day = today;
  if (!(`${today}.${type}` in log)) day = addDays(today, -1);
  let n = 0;
  while (`${day}.${type}` in log) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

function dayHasAny(log: CompletionLog, day: string): boolean {
  return TYPE_ORDER.some((t) => `${day}.${t}` in log);
}

function dayHasAll(log: CompletionLog, day: string): boolean {
  return TYPE_ORDER.every((t) => `${day}.${t}` in log);
}

export function anyStreak(log: CompletionLog, today: string): number {
  let day = today;
  if (!dayHasAny(log, day)) day = addDays(day, -1);
  let n = 0;
  while (dayHasAny(log, day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function allStreak(log: CompletionLog, today: string): number {
  let day = today;
  if (!dayHasAll(log, day)) day = addDays(day, -1);
  let n = 0;
  while (dayHasAll(log, day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export interface TypeStats {
  played: number;
  bestMs: number | null;
  avgMs: number | null;
  streak: number;
}

export function typeStats(log: CompletionLog, type: PuzzleType, today: string): TypeStats {
  let played = 0;
  let bestMs: number | null = null;
  let sum = 0;
  for (const [key, c] of Object.entries(log)) {
    if (!key.endsWith(`.${type}`)) continue;
    played++;
    sum += c.timeMs;
    if (bestMs === null || c.timeMs < bestMs) bestMs = c.timeMs;
  }
  return {
    played,
    bestMs,
    avgMs: played ? Math.round(sum / played) : null,
    streak: typeStreak(log, type, today),
  };
}
