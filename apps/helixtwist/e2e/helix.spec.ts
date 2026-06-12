import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'helixtwist');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __helix: {
      depth: () => number;
      score: () => number;
      phase: () => string;
      start: () => void;
      rotate: (rad: number) => void;
      alignGap: () => void;
      alignDanger: () => void;
      restart: (next: boolean) => void;
    };
  }
}

test('ready overlay shows start-btn; click starts game', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('start-overlay')).toBeVisible();
  await page.getByTestId('start-btn').click();
  await expect(page.getByTestId('start-overlay')).not.toBeVisible();
  const phase = await page.evaluate(() => window.__helix.phase());
  expect(phase).toBe('playing');
});

test('aligned gaps drop the ball; danger kills; restart works', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__helix !== 'undefined');

  // start the game
  await page.getByTestId('start-btn').click();
  await expect(page.getByTestId('start-overlay')).not.toBeVisible();

  // keep the gap aligned → ball should pass several rings
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => window.__helix.alignGap());
    await page.waitForTimeout(220);
  }
  const depth = await page.evaluate(() => window.__helix.depth());
  expect(depth).toBeGreaterThanOrEqual(2);
  const score = await page.evaluate(() => window.__helix.score());
  expect(score).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  // park on danger until death
  for (let i = 0; i < 30; i++) {
    const phase = await page.evaluate(() => window.__helix.phase());
    if (phase === 'dead') break;
    await page.evaluate(() => window.__helix.alignDanger());
    await page.waitForTimeout(220);
  }
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(ARTIFACTS, 'death-mobile-dark.png') });

  await page.getByTestId('continue-btn').click();
  await expect(page.getByTestId('result-overlay')).not.toBeVisible();
  const d2 = await page.evaluate(() => window.__helix.depth());
  expect(d2).toBe(0);
});

test('real input: mouse drag spins tower; 1440x900 + 390x844 screenshots', async ({ page }) => {
  // Desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__helix !== 'undefined');
  await page.getByTestId('start-btn').click();
  await page.waitForTimeout(300);

  const canvas = page.getByTestId('game-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    // drag to spin the tower
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5);
    await page.waitForTimeout(200);
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
    await page.waitForTimeout(200);
    await page.mouse.up();
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS, 'real-input-desktop.png') });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__helix !== 'undefined');
  await page.getByTestId('start-btn').click();
  await page.waitForTimeout(300);

  const box2 = await canvas.boundingBox();
  if (box2) {
    await page.mouse.move(box2.x + box2.width * 0.5, box2.y + box2.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width * 0.75, box2.y + box2.height * 0.5);
    await page.waitForTimeout(200);
    await page.mouse.move(box2.x + box2.width * 0.25, box2.y + box2.height * 0.5);
    await page.waitForTimeout(200);
    await page.mouse.up();
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACTS, 'real-input-mobile.png') });
});
