/**
 * Daily Anagrams engine.
 * Daily 7-letter rack seeded from popular words; find valid words of len ≥ 3.
 */
import { Rng, utcDateString } from '@daily-logic/engine';
import { POPULAR } from './data/popular';

export interface AnagramsPuzzle {
  date: string;
  rack: string[];        // 7 letters, shuffled
  baseWord: string;      // the source 7-letter word (not shown to player)
  solutions: string[];   // all valid words buildable from rack
  maxScore: number;
}

export type AnagramRank = 'Good' | 'Great' | 'Genius';

const SEVEN_LETTER = POPULAR.filter((w) => w.length === 7);
/** Build a multiset character count */
function charCount(word: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of word) map[c] = (map[c] ?? 0) + 1;
  return map;
}

/** Can `word` be built from the rack multiset? */
export function canBuildFromRack(word: string, rack: string[]): boolean {
  const rackCount = charCount(rack.join(''));
  for (const c of word) {
    rackCount[c] = (rackCount[c] ?? 0) - 1;
    if (rackCount[c] < 0) return false;
  }
  return true;
}

function findSolutions(rack: string[]): string[] {
  return POPULAR.filter(
    (w) => w.length >= 3 && w.length <= 7 && canBuildFromRack(w, rack),
  );
}

export function generateAnagramsPuzzle(date: string = utcDateString()): AnagramsPuzzle {
  const rng = new Rng(`word-anagrams:${date}`);

  let baseWord = '';
  let solutions: string[] = [];
  let counter = 0;

  // Re-roll until ≥15 buildable solutions
  while (solutions.length < 15) {
    const seed = counter === 0 ? `word-anagrams:${date}` : `word-anagrams:${date}:${counter}`;
    const r = new Rng(seed);
    baseWord = SEVEN_LETTER[r.int(SEVEN_LETTER.length)] ?? 'problem';
    const letters = baseWord.split('');
    r.shuffle(letters);
    solutions = findSolutions(letters);
    counter++;
  }

  // Now do final shuffle with original rng
  const letters = baseWord.split('');
  rng.shuffle(letters);

  const maxScore = solutions.reduce((s, w) => s + w.length, 0);

  return {
    date,
    rack: letters,
    baseWord,
    solutions,
    maxScore,
  };
}

export function getAnagramRank(score: number, maxScore: number): AnagramRank {
  const pct = maxScore > 0 ? score / maxScore : 0;
  if (pct >= 0.8) return 'Genius';
  if (pct >= 0.5) return 'Great';
  return 'Good';
}

export function buildAnagramShare(
  date: string,
  score: number,
  maxScore: number,
  foundCount: number,
  totalSolutions: number,
  streak: number,
): string {
  const rank = getAnagramRank(score, maxScore);
  const shortDate = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const rankEmoji = rank === 'Genius' ? '🧠' : rank === 'Great' ? '⭐' : '👍';
  return [
    `Daily Word · Anagrams · ${shortDate}`,
    `${rankEmoji} ${rank} · ${score} pts · ${foundCount}/${totalSolutions} words${streak > 1 ? ` · 🔥${streak}` : ''}`,
  ].join('\n');
}
