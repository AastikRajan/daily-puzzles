import { useRef, useState, useEffect, useCallback } from 'react';
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/nunito';
import './styles/global.css';
import { GameEngine, type GameState } from './game/engine';
import { useSettings, applyTheme } from './state/settings';
import { load } from './lib/storage';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import GameOverlay from './components/GameOverlay';
import SettingsDrawer from './components/SettingsDrawer';

const INIT_STATE: GameState = {
  score: 0,
  best: load<number>('best', 0),
  phase: 'playing',
  currentTier: 1,
  nextTier: 2,
};

export default function App() {
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(INIT_STATE);
  const [showSettings, setShowSettings] = useState(false);
  const { theme, reducedMotion, sound } = useSettings();

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

  const handleRestart = useCallback(() => {
    engineRef.current?.restart();
    setGameState(s => ({ ...s, score: 0, phase: 'playing' }));
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100dvh', maxWidth: 500,
      position: 'relative',
    }}>
      <HUD state={gameState} onSettings={() => setShowSettings(true)} />

      {/* Game container — fills remaining space */}
      <div style={{
        flex: 1,
        position: 'relative',
        margin: '0 12px 12px',
        borderRadius: 20,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, rgba(255,240,250,0.6) 0%, rgba(255,248,240,0.6) 100%)',
        boxShadow: '0 4px 24px rgba(220,80,140,0.15), inset 0 0 0 1.5px rgba(255,255,255,0.4)',
      }}>
        <GameCanvas
          onStateChange={setGameState}
          soundEnabled={sound}
          engineRef={engineRef}
        />
        {gameState.phase === 'over' && (
          <GameOverlay state={gameState} onRestart={handleRestart} />
        )}
      </div>

      {showSettings && <SettingsDrawer onClose={() => setShowSettings(false)} />}
    </div>
  );
}
