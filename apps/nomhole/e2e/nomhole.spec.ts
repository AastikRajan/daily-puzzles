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
      phase: () => 'ready' | 'playing' | 'over';
      endRound: () => void;
      restart: () => void;
      start: () => void;
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

test('start button transitions to playing', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');

  // Should be in ready phase — start overlay visible
  await expect(page.getByTestId('start-overlay')).toBeVisible();
  await expect(page.getByTestId('start-btn')).toBeVisible();

  await page.getByTestId('start-btn').click();
  await expect(page.getByTestId('start-overlay')).not.toBeVisible({ timeout: 2000 });

  const phase = await page.evaluate(() => window.__nomhole.phase());
  expect(phase).toBe('playing');
});

test('eatNearest grows score and radius', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');
  await page.getByTestId('start-btn').click();

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
  await page.getByTestId('start-btn').click();

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

  // play-again should go to playing (not ready)
  const phase = await page.evaluate(() => window.__nomhole.phase());
  expect(phase).toBe('playing');
});

test('screenshots: start screen + mid-round city dark + results screen', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');

  // Screenshot the start screen
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACTS, 'start-screen-dark.png') });

  // Now start the game
  await page.getByTestId('start-btn').click();
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

  // Toggle mute (replaces old theme-toggle test)
  await page.getByTestId('mute-toggle').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACTS, 'midround-muted.png') });

  // Unmute
  await page.getByTestId('mute-toggle').click();
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

test('real-input proof — drag gesture desktop+mobile', async ({ page }) => {
  // Desktop 1440×900
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');
  await page.getByTestId('start-btn').click();
  await page.waitForTimeout(400);

  // Drag from center to move the hole
  const canvas = page.getByTestId('game-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Drag toward nearest objects
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(cx + i * 15, cy + i * 10);
      await page.waitForTimeout(80);
    }
    await page.mouse.up();
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS, 'real-input-desktop-1440.png') });

  // Mobile 390×844
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__nomhole !== 'undefined');
  await page.getByTestId('start-btn').click();
  await page.waitForTimeout(400);
  const canvas2 = page.getByTestId('game-canvas');
  const box2 = await canvas2.boundingBox();
  if (box2) {
    const cx2 = box2.x + box2.width / 2;
    const cy2 = box2.y + box2.height / 2;
    await page.mouse.move(cx2, cy2);
    await page.mouse.down();
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(cx2 + i * 8, cy2 + i * 6);
      await page.waitForTimeout(80);
    }
    await page.mouse.up();
  }
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS, 'real-input-mobile-390.png') });
});
