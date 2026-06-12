import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'nomhole');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __nomhole: {
      score: () => number;
      radius: () => number;
      phase: () => 'playing' | 'over';
      endRound: () => void;
      restart: () => void;
      eatNearest: () => void;
    };
  }
}

test('canvas renders', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');
  const canvas = page.getByTestId('game-canvas');
  await expect(canvas).toBeVisible();
});

test('eatNearest grows score and radius', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');

  const r0 = await page.evaluate(() => window.__nomhole.radius());

  // Call eatNearest 6 times with waits to let animations complete
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.__nomhole.eatNearest());
    await page.waitForTimeout(400);
  }

  const score = await page.evaluate(() => window.__nomhole.score());
  const r1 = await page.evaluate(() => window.__nomhole.radius());

  expect(score).toBeGreaterThan(0);
  expect(r1).toBeGreaterThan(r0);
});

test('endRound shows overlay, play again resets score', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');

  // Eat a few things first so score > 0
  await page.evaluate(() => window.__nomhole.eatNearest());
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__nomhole.eatNearest());
  await page.waitForTimeout(400);

  await page.evaluate(() => window.__nomhole.endRound());
  await expect(page.getByTestId('game-over-overlay')).toBeVisible({ timeout: 3000 });

  await page.getByTestId('play-again-btn').click();
  await expect(page.getByTestId('game-over-overlay')).not.toBeVisible();

  const score = await page.evaluate(() => window.__nomhole.score());
  expect(score).toBe(0);
});

test('screenshots: mid-round city dark+light + results screen', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');
  await page.waitForTimeout(600);

  // Eat a few to grow the hole a bit, then let the city populate the view
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__nomhole.eatNearest());
    await page.waitForTimeout(450);
  }

  // Wait a moment for animations and float texts to settle
  await page.waitForTimeout(800);

  // Dark theme mid-round — city visible around the hole
  await page.screenshot({ path: path.join(ARTIFACTS, 'midround-dark.png') });

  // Light theme mid-round
  await page.getByTestId('theme-toggle').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACTS, 'midround-light.png') });

  // Back to dark, eat more to show combo, then end round for results
  await page.getByTestId('theme-toggle').click();
  await page.waitForTimeout(200);

  // Eat a few more quickly for combo
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__nomhole.eatNearest());
    await page.waitForTimeout(200);
  }

  await page.evaluate(() => window.__nomhole.endRound());
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS, 'results-dark.png') });
});
