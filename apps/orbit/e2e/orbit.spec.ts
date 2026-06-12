import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'orbit');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __orbit: {
      score: () => number;
      ring: () => number;
      phase: () => string;
      hop: () => void;
      die: () => void;
      restart: () => void;
      placeStarOnPath: () => void;
    };
  }
}

test('hopping changes rings, stars score, death + restart work', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__orbit !== 'undefined');

  const ring0 = await page.evaluate(() => window.__orbit.ring());
  await page.evaluate(() => window.__orbit.hop());
  await page.waitForTimeout(500);
  const ring1 = await page.evaluate(() => window.__orbit.ring());
  expect(ring1).not.toBe(ring0);

  // guaranteed star pickup: drop one just ahead on the current ring
  await page.evaluate(() => window.__orbit.placeStarOnPath());
  await expect
    .poll(async () => page.evaluate(() => window.__orbit.score()), { timeout: 8000 })
    .toBeGreaterThan(0);

  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  await page.evaluate(() => window.__orbit.die());
  await expect(page.getByTestId('game-over-overlay')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameover-mobile-dark.png') });

  await page.getByTestId('play-again-btn').click();
  await expect(page.getByTestId('game-over-overlay')).not.toBeVisible();
  const score = await page.evaluate(() => window.__orbit.score());
  expect(score).toBe(0);
});

test('light theme screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__orbit !== 'undefined');
  await page.getByLabel('Toggle theme').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
});
