/**
 * Echo Maze — daily seeded perfect maze. Memorize it lit, walk it dark.
 */
import { Rng, difficultyForDate, type Difficulty } from '@daily-logic/engine';

export interface Maze {
  size: number;
  /** walls[cell] bitmask: 1=N 2=E 4=S 8=W (wall present) */
  walls: number[];
  start: number;
  exit: number;
  /** lit-time ms for the reveal phase */
  revealMs: number;
  echoes: number;
}

export const SIZES: Record<Difficulty, number> = { easy: 8, medium: 10, hard: 12 };

export const DIRS = [
  { dx: 0, dy: -1, bit: 1, opp: 4 }, // N
  { dx: 1, dy: 0, bit: 2, opp: 8 },  // E
  { dx: 0, dy: 1, bit: 4, opp: 1 },  // S
  { dx: -1, dy: 0, bit: 8, opp: 2 }, // W
] as const;

/** Recursive-backtracker perfect maze, deterministic per date. */
export function dailyMaze(date: string): Maze {
  const diff = difficultyForDate(date);
  const size = SIZES[diff];
  const rng = new Rng(`echo-maze:${date}`);
  const n = size * size;
  const walls = new Array<number>(n).fill(15);
  const visited = new Array<boolean>(n).fill(false);
  const stack = [0];
  visited[0] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const cx = cur % size;
    const cy = Math.floor(cur / size);
    const options: number[] = [];
    DIRS.forEach((d, i) => {
      const nx = cx + d.dx;
      const ny = cy + d.dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[ny * size + nx]) options.push(i);
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const dir = DIRS[options[rng.int(options.length)]!]!;
    const next = (cy + dir.dy) * size + (cx + dir.dx);
    walls[cur]! &= ~dir.bit;
    walls[next]! &= ~dir.opp;
    visited[next] = true;
    stack.push(next);
  }
  return {
    size,
    walls,
    start: (size - 1) * size, // bottom-left
    exit: size - 1,           // top-right
    revealMs: diff === 'easy' ? 2600 : diff === 'medium' ? 3000 : 3400,
    echoes: 3,
  };
}

/** BFS shortest path start→exit as a list of direction indices. */
export function solveMaze(m: Maze): number[] {
  const prev = new Array<number>(m.size * m.size).fill(-1);
  const prevDir = new Array<number>(m.size * m.size).fill(-1);
  const q = [m.start];
  prev[m.start] = m.start;
  while (q.length) {
    const cur = q.shift()!;
    if (cur === m.exit) break;
    const cx = cur % m.size;
    const cy = Math.floor(cur / m.size);
    DIRS.forEach((d, i) => {
      if (m.walls[cur]! & d.bit) return;
      const nxt = (cy + d.dy) * m.size + (cx + d.dx);
      if (prev[nxt] !== -1) return;
      prev[nxt] = cur;
      prevDir[nxt] = i;
      q.push(nxt);
    });
  }
  const path: number[] = [];
  let c = m.exit;
  while (c !== m.start) {
    path.unshift(prevDir[c]!);
    c = prev[c]!;
  }
  return path;
}

export function canMove(m: Maze, cell: number, dirIdx: number): boolean {
  return (m.walls[cell]! & DIRS[dirIdx]!.bit) === 0;
}

export function step(m: Maze, cell: number, dirIdx: number): number {
  const d = DIRS[dirIdx]!;
  return (Math.floor(cell / m.size) + d.dy) * m.size + (cell % m.size) + d.dx;
}
