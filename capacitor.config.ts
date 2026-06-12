import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wrapper config for the iOS (and later Android) build.
 * The web app is fully self-contained (no backend), so the native shell
 * just hosts the built bundle from apps/web/dist.
 * See PORTING.md for the exact Mac-day steps.
 */
const config: CapacitorConfig = {
  appId: 'app.dailylogic.puzzles',
  appName: 'Daily Logic',
  webDir: 'apps/web/dist',
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#eef2ff',
  },
};

export default config;
