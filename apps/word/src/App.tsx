import { useUi } from './state/ui';
import Home from './views/Home';
import GuessView from './views/GuessView';
import AnagramsView from './views/AnagramsView';
import HuntView from './views/HuntView';
import StatsView from './views/StatsView';
import SettingsView from './views/SettingsView';

export default function App() {
  const screen = useUi((s) => s.screen);

  switch (screen) {
    case 'home': return <Home />;
    case 'guess': return <GuessView />;
    case 'anagrams': return <AnagramsView />;
    case 'hunt': return <HuntView />;
    case 'stats': return <StatsView />;
    case 'settings': return <SettingsView />;
  }
}
