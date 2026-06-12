import { create } from 'zustand';
import { utcDateString } from '@daily-logic/engine';
import { generateCourse } from '../engine/course';
import { shoot as physShoot, step as physStep } from '../engine/physics';
import type { HoleDef, BallState } from '../engine/types';
import { load, save } from '../lib/storage';

export type Phase = 'banner' | 'playing' | 'sinking' | 'scorecard';

export interface Stats {
  daysPlayed: number;
  bestVsPar: number;
  streak: number;
  lastDate: string;
}

const MAX_STROKES = 8;

interface GameState {
  date: string;
  holes: HoleDef[];
  holeIndex: number;
  strokes: number[];       // length 9
  phase: Phase;
  ballState: BallState;
  gateT: number;
  aimAngle: number | null;
  aimPower: number | null; // 0–1
  stats: Stats;

  // Actions
  startHole: () => void;
  shoot: (angleRad: number, power01: number) => void;
  tickPhysics: (dt: number) => void;
  advanceHole: () => void;
  skipHole: () => void;
  resetToday: () => void;
  setAim: (angle: number | null, power: number | null) => void;
}

function makeInitialBall(hole: HoleDef): BallState {
  return { x: hole.tee.x, y: hole.tee.y, vx: 0, vy: 0, status: 'idle' };
}

function loadStats(): Stats {
  return load<Stats>('stats', {
    daysPlayed: 0,
    bestVsPar: 0,
    streak: 0,
    lastDate: '',
  });
}

export const useGame = create<GameState>((set, get) => {
  const date = utcDateString();
  const holes = generateCourse(date);
  const stats = loadStats();

  const initBall = makeInitialBall(holes[0]!);

  return {
    date,
    holes,
    holeIndex: 0,
    strokes: new Array(9).fill(0),
    phase: 'banner',
    ballState: initBall,
    gateT: 0,
    aimAngle: null,
    aimPower: null,
    stats,

    startHole: () => {
      const { holes, holeIndex } = get();
      const hole = holes[holeIndex]!;
      set({
        ballState: makeInitialBall(hole),
        phase: 'playing',
        aimAngle: null,
        aimPower: null,
      });
    },

    setAim: (angle, power) => set({ aimAngle: angle, aimPower: power }),

    shoot: (angleRad, power01) => {
      const { ballState, strokes, holeIndex } = get();
      if (ballState.status === 'rolling') return;

      const newBall = physShoot(ballState, angleRad, power01);
      const newStrokes = [...strokes];
      newStrokes[holeIndex] = (newStrokes[holeIndex] ?? 0) + 1;

      set({
        ballState: newBall,
        strokes: newStrokes,
        aimAngle: null,
        aimPower: null,
      });
    },

    tickPhysics: (dt: number) => {
      const { ballState, holes, holeIndex, strokes, gateT } = get();
      if (ballState.status !== 'rolling') return;

      const hole = holes[holeIndex]!;
      const { ball, sunk } = physStep(ballState, hole, dt, gateT);
      const newGateT = gateT + dt;

      if (sunk) {
        set({ ballState: ball, gateT: newGateT, phase: 'sinking' });
        // Auto-advance after animation
        setTimeout(() => {
          get().advanceHole();
        }, 400);
        return;
      }

      // Check max strokes — if stopped and maxed out, force advance
      if (ball.status === 'stopped') {
        const currentStrokes = strokes[holeIndex] ?? 0;
        if (currentStrokes >= MAX_STROKES) {
          // Record max and advance
          const newStrokes = [...strokes];
          newStrokes[holeIndex] = MAX_STROKES;
          set({ ballState: ball, gateT: newGateT, strokes: newStrokes });
          setTimeout(() => get().advanceHole(), 600);
          return;
        }
      }

      set({ ballState: ball, gateT: newGateT });
    },

    advanceHole: () => {
      const { holeIndex, holes, strokes, date, stats } = get();
      const nextIndex = holeIndex + 1;

      if (nextIndex >= 9) {
        // Game complete — update stats
        const totalStrokes = strokes.reduce((a, b) => a + b, 0);
        const totalPar = holes.reduce((a, h) => a + h.par, 0);
        const vsPar = totalStrokes - totalPar;

        const today = utcDateString();
        const yesterday = (() => {
          const d = new Date(`${today}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          return d.toISOString().slice(0, 10);
        })();

        const streak =
          stats.lastDate === yesterday || stats.lastDate === today
            ? (stats.lastDate === today ? stats.streak : stats.streak + 1)
            : 1;

        const bestVsPar =
          stats.daysPlayed === 0 ? vsPar : Math.min(stats.bestVsPar, vsPar);

        const newStats: Stats = {
          daysPlayed: stats.daysPlayed + (stats.lastDate === date ? 0 : 1),
          bestVsPar,
          streak,
          lastDate: date,
        };

        // Save today's scores
        save(`scores.${date}`, strokes);
        save('stats', newStats);

        set({ phase: 'scorecard', stats: newStats });
        return;
      }

      const hole = holes[nextIndex]!;
      set({
        holeIndex: nextIndex,
        ballState: makeInitialBall(hole),
        phase: 'banner',
        gateT: 0,
        aimAngle: null,
        aimPower: null,
      });
    },

    skipHole: () => {
      const { holeIndex, strokes } = get();
      const newStrokes = [...strokes];
      if ((newStrokes[holeIndex] ?? 0) === 0) {
        newStrokes[holeIndex] = MAX_STROKES;
      }
      set({ strokes: newStrokes });
      get().advanceHole();
    },

    resetToday: () => {
      const date = utcDateString();
      const holes = generateCourse(date);
      set({
        date,
        holes,
        holeIndex: 0,
        strokes: new Array(9).fill(0),
        phase: 'banner',
        ballState: makeInitialBall(holes[0]!),
        gateT: 0,
        aimAngle: null,
        aimPower: null,
      });
    },
  };
});
