import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4179',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build:test && npm run preview -- --port 4179 --strictPort',
    url: 'http://localhost:4179',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
  ],
});
