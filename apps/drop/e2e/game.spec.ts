import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'drop');

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

/** Helper: click start-btn then wait for debug API to be ready */
async function startGame(page: import('@playwright/test').Page) {
  await page.locator('[data-testid="start-btn"]').click();
  await page.waitForFunction(() => typeof window.__mergeDrop !== 'undefined' && window.__mergeDrop.score() === 0);
}

test('game loads and canvas is visible', async ({ page }) => {
  await page.goto('./');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  // Start button must be present on ready screen
  await expect(page.locator('[data-testid="start-btn"]')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACTS, 'start-screen.png') });
});

test('drop orbs and score increases', async ({ page }) => {
  await page.goto('./');
  await startGame(page);

  const initialScore = await page.evaluate(() => window.__mergeDrop.score());
  expect(initialScore).toBe(0);

  // Drop orbs close together at nearby positions to force merges
  // Use same x positions so tier-1 orbs land on each other
  const drops = [0.4, 0.42, 0.4, 0.42, 0.44, 0.4, 0.42, 0.44];
  for (const xFrac of drops) {
    await page.evaluate((x) => window.__mergeDrop.dropAt(x), xFrac);
    await page.waitForTimeout(600); // let physics settle between drops
  }

  // Wait extra for merges to settle
  await page.waitForTimeout(3000);

  const score = await page.evaluate(() => window.__mergeDrop.score());
  expect(score).toBeGreaterThan(0);
});

test('forceGameOver shows overlay and restart resets score', async ({ page }) => {
  await page.goto('./');
  await startGame(page);

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

  // After restart, game goes to 'playing' (NOT 'ready') — debug API still works
  const scoreAfterRestart = await page.evaluate(() => window.__mergeDrop.score());
  expect(scoreAfterRestart).toBe(0);

  // Overlay should be gone
  await expect(overlay).not.toBeVisible();
});

test('screenshots — light gameplay', async ({ page }) => {
  await page.goto('./');
  await startGame(page);

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

  await startGame(page);

  for (const xFrac of [0.3, 0.55, 0.45, 0.65, 0.25, 0.5]) {
    await page.evaluate((x) => window.__mergeDrop.dropAt(x), xFrac);
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png'), fullPage: false });
});

test('screenshots — game over screen', async ({ page }) => {
  await page.goto('./');
  await startGame(page);

  for (const xFrac of [0.3, 0.5, 0.7]) {
    await page.evaluate((x) => window.__mergeDrop.dropAt(x), xFrac);
    await page.waitForTimeout(400);
  }

  await page.evaluate(() => window.__mergeDrop.forceGameOver());

  await page.locator('[data-testid="game-over-overlay"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(400); // let overlay animate in

  await page.screenshot({ path: path.join(ARTIFACTS, 'gameover-mobile-light.png'), fullPage: false });
});

test('real-input proof', async ({ page }) => {
  // Desktop 1440x900
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await startGame(page);
  await page.waitForTimeout(300);

  // Use real mouse to aim and drop several orbs
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (box) {
    for (let i = 0; i < 5; i++) {
      const x = box.x + box.width * (0.3 + i * 0.1);
      const y = box.y + 40;
      await page.mouse.move(x, y);
      await page.waitForTimeout(80);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS, 'real-input-desktop-1440.png'), fullPage: false });

  // Mobile 390x844
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await startGame(page);
  await page.waitForTimeout(300);

  const box2 = await page.locator('canvas').boundingBox();
  if (box2) {
    for (let i = 0; i < 5; i++) {
      const x = box2.x + box2.width * (0.3 + i * 0.08);
      const y = box2.y + 40;
      await page.mouse.move(x, y);
      await page.waitForTimeout(80);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(500);
    }
  }
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACTS, 'real-input-mobile-390.png'), fullPage: false });
});
