/**
 * Daily Word Hunt engine.
 * 8×8 grid hiding 6 popular words (len 4-7); player drags to find them.
 */
import { Rng, utcDateString } from '@daily-logic/engine';
import { POPULAR } from './data/popular';

export const GRID_SIZE = 8;
export const WORD_COUNT = 6;

export type Direction =
  | 'E'   // →
  | 'W'   // ←
  | 'S'   // ↓
  | 'N'   // ↑
  | 'SE'  // ↘
  | 'SW'  // ↙
  | 'NE'  // ↗
  | 'NW'; // ↖

export interface PlacedWord {
  word: string;
  row: number;
  col: number;
  dir: Direction;
  cells: Array<{ row: number; col: number }>;
}

export interface HuntPuzzle {
  date: string;
  grid: string[][];   // 8×8 uppercase letters
  words: PlacedWord[];
}

const CANDIDATES = POPULAR.filter((w) => w.length >= 4 && w.length <= 7);

const DIR_DELTAS: Record<Direction, [number, number]> = {
  E:  [0,  1],
  W:  [0, -1],
  S:  [1,  0],
  N:  [-1, 0],
  SE: [1,  1],
  SW: [1, -1],
  NE: [-1,  1],
  NW: [-1, -1],
};
const DIRECTIONS = Object.keys(DIR_DELTAS) as Direction[];

function wordCells(word: string, row: number, col: number, dir: Direction) {
  const [dr, dc] = DIR_DELTAS[dir];
  return word.split('').map((_, i) => ({ row: row + dr * i, col: col + dc * i }));
}

function canPlace(grid: string[][], word: string, row: number, col: number, dir: Direction): boolean {
  const cells = wordCells(word, row, col, dir);
  for (const { row: r, col: c } of cells) {
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE) return false;
    const existing = grid[r]?.[c];
    if (existing && existing !== '.' && existing !== word[cells.indexOf({ row: r, col: c })]) {
      // allow overlaps where letters match
      const idx = cells.findIndex((cell) => cell.row === r && cell.col === c);
      if (existing !== word[idx]?.toUpperCase()) return false;
    }
  }
  return true;
}

function placeWord(grid: string[][], word: string, row: number, col: number, dir: Direction): void {
  const cells = wordCells(word, row, col, dir);
  for (let i = 0; i < cells.length; i++) {
    const { row: r, col: c } = cells[i]!;
    grid[r]![c] = word[i]!.toUpperCase();
  }
}

export function generateHuntPuzzle(date: string = utcDateString()): HuntPuzzle {
  const rng = new Rng(`word-hunt:${date}`);

  // Initialize empty grid
  const grid: string[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill('.'),
  );

  const placed: PlacedWord[] = [];
  const usedWords = new Set<string>();

  // Shuffle a pool of candidates and try to place WORD_COUNT
  const pool = [...CANDIDATES];
  rng.shuffle(pool);

  let poolIdx = 0;
  const MAX_ATTEMPTS = 2000;

  while (placed.length < WORD_COUNT && poolIdx < pool.length) {
    const word = pool[poolIdx++]!;
    if (usedWords.has(word)) continue;

    // Try random positions and directions
    let placed_this = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS / pool.length + 10; attempt++) {
      const dir = DIRECTIONS[rng.int(DIRECTIONS.length)]!;
      const row = rng.int(GRID_SIZE);
      const col = rng.int(GRID_SIZE);

      if (canPlace(grid, word, row, col, dir)) {
        placeWord(grid, word, row, col, dir);
        const cells = wordCells(word, row, col, dir);
        placed.push({ word, row, col, dir, cells });
        usedWords.add(word);
        placed_this = true;
        break;
      }
    }
    if (!placed_this && placed.length < WORD_COUNT) continue;
  }

  // Fill remaining empty cells with random letters
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r]![c] === '.') {
        grid[r]![c] = LETTERS[rng.int(26)]!;
      }
    }
  }

  return { date, grid, words: placed };
}

export function buildHuntShare(
  date: string,
  elapsedMs: number,
  foundCount: number,
  streak: number,
): string {
  const m = Math.floor(elapsedMs / 60000);
  const s = Math.floor((elapsedMs % 60000) / 1000);
  const timeStr = `${m}:${String(s).padStart(2, '0')}`;
  const shortDate = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return [
    `Daily Word · Word Hunt · ${shortDate}`,
    `🔍 Found ${foundCount}/${WORD_COUNT} · ⏱️ ${timeStr}${streak > 1 ? ` · 🔥${streak}` : ''}`,
  ].join('\n');
}
