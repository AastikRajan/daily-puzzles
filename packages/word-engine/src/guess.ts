/**
 * Daily Guess (Wordle-style) engine.
 * Deterministic: same date → same answer worldwide.
 */
import { Rng, utcDateString } from '@daily-logic/engine';
import { ANSWERS } from './data/answers';
import { GUESSES } from './data/guesses';

export type LetterState = 'correct' | 'present' | 'absent' | 'unknown';

export interface GuessResult {
  word: string;
  states: LetterState[];
}

export interface GuessPuzzle {
  date: string;
  answer: string;
  maxGuesses: number;
}

const VALID_SET = new Set([...GUESSES, ...ANSWERS]);

export function dailyGuessAnswer(date: string = utcDateString()): string {
  const rng = new Rng(`word-guess:${date}`);
  return ANSWERS[rng.int(ANSWERS.length)];
}

export function generateGuessPuzzle(date: string = utcDateString()): GuessPuzzle {
  return {
    date,
    answer: dailyGuessAnswer(date),
    maxGuesses: 6,
  };
}

export function isValidGuessWord(word: string): boolean {
  return VALID_SET.has(word.toLowerCase());
}

export function scoreGuess(guess: string, answer: string): LetterState[] {
  const g = guess.toLowerCase().split('');
  const a = answer.toLowerCase().split('');
  const result: LetterState[] = new Array(5).fill('absent');
  const answerCount: Record<string, number> = {};

  // First pass: mark correct letters
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      result[i] = 'correct';
    } else {
      answerCount[a[i]] = (answerCount[a[i]] ?? 0) + 1;
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < 5; i++) {
    if (result[i] === 'correct') continue;
    const letter = g[i];
    if (letter && answerCount[letter] && answerCount[letter] > 0) {
      result[i] = 'present';
      answerCount[letter]--;
    }
  }

  return result;
}

export function getKeyStates(results: GuessResult[]): Record<string, LetterState> {
  const states: Record<string, LetterState> = {};
  const priority: Record<LetterState, number> = {
    correct: 3,
    present: 2,
    absent: 1,
    unknown: 0,
  };

  for (const result of results) {
    for (let i = 0; i < result.word.length; i++) {
      const letter = result.word[i];
      const state = result.states[i];
      if (!letter || !state) continue;
      const current = states[letter] ?? 'unknown';
      if (priority[state] > priority[current]) {
        states[letter] = state;
      }
    }
  }

  return states;
}

export function buildGuessShare(
  date: string,
  guesses: GuessResult[],
  won: boolean,
  streak: number,
): string {
  const attempts = won ? `${guesses.length}/6` : 'X/6';
  const rows = guesses
    .map((g) =>
      g.states
        .map((s) => (s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛'))
        .join(''),
    )
    .join('\n');
  const shortDate = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return [
    `Daily Word · Guess · ${shortDate} · ${attempts}${streak > 1 ? ` · 🔥${streak}` : ''}`,
    rows,
  ]
    .filter(Boolean)
    .join('\n');
}
