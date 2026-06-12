import { useRef, useState, useEffect, useCallback } from 'react';
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/nunito';
import './styles/global.css';
import { GameEngine, type GameState } from './game/engine';
import { useSettings, applyTheme } from './state/settings';
import { load, save } from './lib/storage';
import { isMuted, setMuted, sfxClick, resumeCtx } from './lib/sfx';
import GameOverlay from './components/GameOverlay';

export default function App() {
  const engineRef = useRef<GameEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  const [gameState, setGameState] = useState<GameState>(() => ({
    score: 0,
    best: load<number>('best', 0),
    phase: 'ready',
    currentTier: 1,
    nextTier: 2,
  }));
  const [muteFlag, setMuteFlag] = useState<boolean>(() => isMuted());

  const { theme, reducedMotion } = useSettings();

  // Apply theme on mount + changes
  useEffect(() => {
    applyTheme(theme, reducedMotion);
  }, [theme, reducedMotion]);

  // Also apply on system preference change
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(theme, reducedMotion);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme, reducedMotion]);

  // Create engine once canvas is mounted
  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    if (!canvas || !scene) return;

    const best = load<number>('best', 0);
    const engine = new GameEngine(canvas, best);
    engineRef.current = engine;

    engine.setOnStateChange((s) => {
      if (s.score > load<number>('best', 0)) save('best', s.score);
      setGameState(s);
    });

    const ro = new ResizeObserver(() => {
      if (!canvas.parentElement) return;
      engine.resize(canvas.parentElement.clientWidth, canvas.parentElement.clientHeight);
    });
    ro.observe(scene);
    engine.resize(scene.clientWidth, scene.clientHeight);

    return () => {
      engine.destroy();
      ro.disconnect();
      engineRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    resumeCtx();
    sfxClick();
    engineRef.current?.start();
  }, []);

  const handleRestart = useCallback(() => {
    engineRef.current?.restart();
  }, []);

  const handleMuteToggle = useCallback(() => {
    sfxClick();
    const next = !isMuted();
    setMuted(next);
    setMuteFlag(next);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.phase !== 'playing') return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    engineRef.current?.setAimX(e.clientX - rect.left);
  }, [gameState.phase]);

  const onPointerLeave = useCallback(() => {
    engineRef.current?.clearAim();
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (gameState.phase !== 'playing') return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    engineRef.current?.drop(e.clientX - rect.left);
  }, [gameState.phase]);

  return (
    <div className="game-root">
      {/* Gutters — painted with candy gradient on wide screens */}
      <div className="gutter left" />
      <div className="gutter right" />

      {/* Portrait game scene */}
      <div className="game-scene" ref={sceneRef}>
        {/* Canvas fills scene */}
        <canvas
          ref={canvasRef}
          style={{ display: 'block', position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        />

        {/* HUD — score + best chips, top-center */}
        {gameState.phase !== 'ready' && (
          <div className="hud">
            <div className="chip">Score <strong data-testid="score-value">{gameState.score}</strong></div>
            <div className="chip">Best <strong>{gameState.best}</strong></div>
          </div>
        )}

        {/* Mute toggle — top-right */}
        <button
          className="chip theme-btn"
          data-testid="mute-toggle"
          aria-label={muteFlag ? 'Unmute' : 'Mute'}
          onClick={handleMuteToggle}
        >
          {muteFlag ? '🔇' : '🔊'}
        </button>

        {/* Hint text — bottom, hidden on ready */}
        {gameState.phase === 'playing' && (
          <p className="hint-text">move to aim · release to drop</p>
        )}

        {/* Start overlay — shown when phase === 'ready' */}
        {gameState.phase === 'ready' && (
          <div className="start-overlay">
            <h1 className="start-title">Merge Drop</h1>
            <p className="start-sub">drop, merge, don&rsquo;t overflow</p>
            <div className="howto-row">
              <span>👆 aim · release = drop</span>
              <span>same = merge!</span>
            </div>
            <button
              className="btn3d start-btn"
              data-testid="start-btn"
              onClick={handleStart}
            >
              PLAY
            </button>
          </div>
        )}

        {/* Game-over overlay */}
        {gameState.phase === 'over' && (
          <GameOverlay state={gameState} onRestart={handleRestart} />
        )}
      </div>
    </div>
  );
}
