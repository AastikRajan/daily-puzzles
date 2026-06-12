import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/baloo-2';
import '@fontsource-variable/nunito';
import './styles/global.css';
import App from './App';
import { useSettings, applyTheme } from './state/settings';

function Root() {
  const { theme, reducedMotion } = useSettings();

  useEffect(() => {
    applyTheme(theme, reducedMotion);
  }, [theme, reducedMotion]);

  useEffect(() => {
    applyTheme(useSettings.getState().theme, useSettings.getState().reducedMotion);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const s = useSettings.getState();
      applyTheme(s.theme, s.reducedMotion);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
