import { useEffect, useRef, useCallback } from 'react';
import { GameEngine, type GameState } from '../game/engine';
import { load, save } from '../lib/storage';

interface Props {
  onStateChange: (s: GameState) => void;
  soundEnabled: boolean;
  engineRef: React.MutableRefObject<GameEngine | null>;
}

export default function GameCanvas({ onStateChange, soundEnabled, engineRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const best = load<number>('best', 0);
    const engine = new GameEngine(canvas, best);
    engineRef.current = engine;
    engine.setSoundEnabled(soundEnabled);
    engine.setOnStateChange((s) => {
      if (s.score > load<number>('best', 0)) save('best', s.score);
      onStateChange(s);
    });

    const parent = canvas.parentElement!;

    const ro = new ResizeObserver(() => {
      if (!canvas.parentElement) return;
      engine.resize(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight);
    });
    ro.observe(parent);

    // Initial size
    engine.resize(parent.clientWidth, parent.clientHeight);

    return () => {
      engine.destroy();
      ro.disconnect();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update sound flag without recreating engine
  useEffect(() => {
    engineRef.current?.setSoundEnabled(soundEnabled);
  }, [soundEnabled, engineRef]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    engineRef.current?.setAimX(e.clientX - rect.left);
  }, [engineRef]);

  const onPointerLeave = useCallback(() => {
    engineRef.current?.clearAim();
  }, [engineRef]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    engineRef.current?.drop(e.clientX - rect.left);
  }, [engineRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    />
  );
}
