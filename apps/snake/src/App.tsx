import React, { useEffect } from 'react';
import { useSettings, applyTheme } from './state/settings';
import GameView from './components/GameView';

export default function App() {
  const { theme, reducedMotion } = useSettings();
  useEffect(() => {
    applyTheme(theme, reducedMotion);
  }, [theme, reducedMotion]);

  return <GameView />;
}
