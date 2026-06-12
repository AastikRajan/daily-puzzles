import { useEffect } from 'react';
import { useUi } from './state/ui';
import { useSettings, applyTheme } from './state/settings';
import Home from './views/Home';
import PuzzleView from './views/PuzzleView';
import Stats from './views/Stats';
import Settings from './views/Settings';

export default function App() {
  const screen = useUi((s) => s.screen);
  const theme = useSettings((s) => s.theme);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  useEffect(() => {
    applyTheme(theme, reducedMotion);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(theme, reducedMotion);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, reducedMotion]);

  switch (screen) {
    case 'puzzle': return <PuzzleView />;
    case 'stats': return <Stats />;
    case 'settings': return <Settings />;
    default: return <Home />;
  }
}
