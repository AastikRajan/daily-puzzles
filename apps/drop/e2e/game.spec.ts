import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACTS = path.join(__dirname, '..', '..', '..', 'artifacts', 'drop');

type MergeDropAPI = {
  score: () => number;
  forceGameOver: () => void;
  dropAt: (xFrac: number) => void;
};

declare global {
  interface Window {
    __mergeDrop: MergeDropAPI;
  }
}

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

test('game loads and canvas is visible', async ({ page }) => {
  await page.goto('./');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  // HUD score chip is present
  await expect(page.getByText('Score')).toBeVisible();
});

test('drop orbs and score increases', async ({ page }) => {
  await page.goto('./');

  // Wait for game engine to expose debug API
  await page.waitForFunction(() => typeof window.__mergeDrop !== 'undefined');

  const initialScore = await page.evaluate(() => window.__mergeDrop.score());
  expect(initialScore).toBe(0);

  // Drop 8 orbs at varied x positions
  const drops = [0.2, 0.35, 0.5, 0.65, 0.8, 0.3, 0.55, 0.45];
  for (const xFrac of drops) {
    await page.evaluate((x) => window.__mergeDrop.dropAt(x), xFrac);
    await page.waitForTimeout(500); // let physics settle between drops
  }

  // Wait extra for merges to settle
  await page.waitForTimeout(2000);

  const score = await page.evaluate(() => window.__mergeDrop.score());
  expect(score).toBeGreaterThan(0);
});

test('forceGameOver shows overlay and restart resets score', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__mergeDrop !== 'undefined');

  // Drop a few orbs first
  for (const xFrac of [0.3, 0.5, 0.7]) {
    await page.evaluate((x) => window.__mergeDrop.dropAt(x), xFrac);
    await page.waitForTimeout(450);
  }

  // Force game over
  await page.evaluate(() => window.__mergeDrop.forceGameOver());

  // Overlay must appear
  const overlay = page.locator('[data-testid="game-over-overlay"]');
  await expect(overlay).toBeVisible({ timeout: 5000 });

  // Play Again button must be present
  const playAgain = page.locator('[data-testid="play-again-btn"]');
  await expect(playAgain).toBeVisible();

  // Click Play Again and verify score resets to 0
  await playAgain.click();
  await page.waitForTimeout(300);

  const scoreAfterRestart = await page.evaluate(() => window.__mergeDrop.score());
  expect(scoreAfterRestart).toBe(0);

  // Overlay should be gone
  await expect(overlay).not.toBeVisible();
});

test('screenshots — light gameplay', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__mergeDrop !== 'undefined');

  for (const xFrac of [0.25, 0.5, 0.6, 0.4, 0.7, 0.35]) {
    await page.evaluate((x) => window.__mergeDrop.dropAt(x), xFrac);
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png'), fullPage: false });
});

test('screenshots — dark gameplay', async ({ page }) => {
  await page.goto('./');
  // Force dark theme
  await page.evaluate(() => { document.documentElement.dataset['theme'] = 'dark'; });

  await page.waitForFunction(() => typeof window.__mergeDrop !== 'undefined');

  for (const xFrac of [0.3, 0.55, 0.45, 0.65, 0.25, 0.5]) {
    await page.evaluate((x) => window.__mergeDrop.dropAt(x), xFrac);
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png'), fullPage: false });
});

test('screenshots — game over screen', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__mergeDrop !== 'undefined');

  for (const xFrac of [0.3, 0.5, 0.7]) {
    await page.evaluate((x) => window.__mergeDrop.dropAt(x), xFrac);
    await page.waitForTimeout(400);
  }

  await page.evaluate(() => window.__mergeDrop.forceGameOver());

  await page.locator('[data-testid="game-over-overlay"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400); // let overlay animate in

  await page.screenshot({ path: path.join(ARTIFACTS, 'gameover-mobile-light.png'), fullPage: false });
});
