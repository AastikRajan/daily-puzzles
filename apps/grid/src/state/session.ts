import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GridPuzzleType } from '@daily-logic/grid-engine';
import { load, save } from '../lib/storage';
import { useProgress } from './progress';
import * as haptics from '../lib/haptics';

interface SessionData<TState> {
  state: TState;
  history: TState[];
  future: TState[];
  elapsedMs: number;
  mistakes: number;
  hintsUsed: number;
  completed: boolean;
}

const MAX_HISTORY = 200;

export function usePuzzleSession<TState>(opts: {
  date: string;
  type: GridPuzzleType;
  initial: () => TState;
  isSolved: (s: TState) => boolean;
}) {
  const { date, type, isSolved } = opts;
  const storageKey = `session.${date}.${type}`;
  const recordCompletion = useProgress((s) => s.recordCompletion);

  const [data, setData] = useState<SessionData<TState>>(() =>
    load<SessionData<TState> | null>(storageKey, null) ?? {
      state: opts.initial(),
      history: [],
      future: [],
      elapsedMs: 0,
      mistakes: 0,
      hintsUsed: 0,
      completed: false,
    },
  );

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    save(storageKey, data);
  }, [data, storageKey]);

  useEffect(() => {
    if (data.completed) return;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setData((d) => (d.completed ? d : { ...d, elapsedMs: d.elapsedMs + 1000 }));
    }, 1000);
    return () => clearInterval(id);
  }, [data.completed]);

  const finish = useCallback(
    (d: SessionData<TState>): SessionData<TState> => {
      recordCompletion(date, type, {
        timeMs: d.elapsedMs,
        mistakes: d.mistakes,
        hintsUsed: d.hintsUsed,
        completedAt: Date.now(),
      });
      haptics.win();
      return { ...d, completed: true };
    },
    [date, type, recordCompletion],
  );

  const apply = useCallback(
    (next: TState, opts2?: { mistake?: boolean; hint?: boolean }) => {
      setData((d) => {
        if (d.completed) return d;
        let nd: SessionData<TState> = {
          ...d,
          state: next,
          history: [...d.history.slice(-MAX_HISTORY), d.state],
          future: [],
          mistakes: d.mistakes + (opts2?.mistake ? 1 : 0),
          hintsUsed: d.hintsUsed + (opts2?.hint ? 1 : 0),
        };
        if (isSolved(next)) nd = finish(nd);
        return nd;
      });
    },
    [isSolved, finish],
  );

  const undo = useCallback(() => {
    setData((d) => {
      if (d.completed || d.history.length === 0) return d;
      const prev = d.history[d.history.length - 1];
      return { ...d, state: prev, history: d.history.slice(0, -1), future: [d.state, ...d.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setData((d) => {
      if (d.completed || d.future.length === 0) return d;
      const [next, ...rest] = d.future;
      let nd: SessionData<TState> = {
        ...d, state: next, history: [...d.history, d.state], future: rest,
      };
      if (isSolved(next)) nd = finish(nd);
      return nd;
    });
  }, [isSolved, finish]);

  return useMemo(
    () => ({
      state: data.state,
      completed: data.completed,
      elapsedMs: data.elapsedMs,
      mistakes: data.mistakes,
      hintsUsed: data.hintsUsed,
      canUndo: data.history.length > 0 && !data.completed,
      canRedo: data.future.length > 0 && !data.completed,
      apply,
      undo,
      redo,
    }),
    [data, apply, undo, redo],
  );
}
