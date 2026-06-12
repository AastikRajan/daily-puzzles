import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'flock');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __flock: {
      count: () => number;
      delivered: () => number;
      level: () => number;
      phase: () => string;
      warpToHome: () => void;
      nextLevel: () => void;
      retry: () => void;
      kill: () => void;
    };
  }
}

test('swarm exists, delivery wins the level, next level starts', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__flock !== 'undefined');

  const count = await page.evaluate(() => window.__flock.count());
  expect(count).toBeGreaterThan(0);

  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  // deliveries: warp the flock into the home ring until the need is met.
  // each warp delivers the current swarm; the level-1 need (22) exceeds the
  // starting swarm (22 boids ≥ need 22) so one or two warps suffice
  for (let i = 0; i < 6; i++) {
    const phase = await page.evaluate(() => window.__flock.phase());
    if (phase === 'won') break;
    await page.evaluate(() => window.__flock.warpToHome());
    await page.waitForTimeout(700);
  }
  await expect
    .poll(async () => page.evaluate(() => window.__flock.phase()), { timeout: 10_000 })
    .toBe('won');

  await expect(page.getByTestId('result-overlay')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'won-mobile-dark.png') });
  await page.getByTestId('continue-btn').click();
  const level = await page.evaluate(() => window.__flock.level());
  expect(level).toBe(2);
});

test('losing the whole swarm shows defeat and retry restores it', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__flock !== 'undefined');
  await page.evaluate(() => window.__flock.kill());
  await expect
    .poll(async () => page.evaluate(() => window.__flock.phase()), { timeout: 5000 })
    .toBe('lost');
  await expect(page.getByTestId('result-overlay')).toBeVisible();
  await page.getByTestId('continue-btn').click();
  const count = await page.evaluate(() => window.__flock.count());
  expect(count).toBeGreaterThan(0);
});

test('light theme screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__flock !== 'undefined');
  await page.getByLabel('Toggle theme').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
});
