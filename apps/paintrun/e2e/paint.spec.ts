import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'paintrun');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __paint: {
      pct: () => number;
      phase: () => string;
      level: () => number;
      start: () => void;
      steer: (frac: number) => void;
      finish: () => void;
      crash: () => void;
      restart: (next: boolean) => void;
    };
  }
}

test('ready overlay shows start-btn; click starts game', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('start-overlay')).toBeVisible();
  await page.getByTestId('start-btn').click();
  await expect(page.getByTestId('start-overlay')).not.toBeVisible();
  const phase = await page.evaluate(() => window.__paint.phase());
  expect(phase).toBe('playing');
});

test('running paints the floor; finish shows stars; next level advances', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__paint !== 'undefined');

  // click start-btn to exit ready phase
  await page.getByTestId('start-btn').click();
  await expect(page.getByTestId('start-overlay')).not.toBeVisible();

  // weave to paint more
  for (let i = 0; i < 8; i++) {
    await page.evaluate((f) => window.__paint.steer(f), i % 2 === 0 ? 0.2 : 0.8);
    await page.waitForTimeout(420);
  }
  const pct = await page.evaluate(() => window.__paint.pct());
  expect(pct).toBeGreaterThan(0);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  // jump to the finish
  await page.evaluate(() => window.__paint.finish());
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: path.join(ARTIFACTS, 'finish-mobile-dark.png') });

  const lvl = await page.evaluate(() => window.__paint.level());
  await page.getByTestId('continue-btn').click();
  await expect(page.getByTestId('result-overlay')).not.toBeVisible();
  const lvl2 = await page.evaluate(() => window.__paint.level());
  expect(lvl2).toBe(lvl + 1);
});

test('crash overlay and retry', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__paint !== 'undefined');
  await page.getByTestId('start-btn').click();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__paint.crash());
  await expect(page.getByTestId('result-overlay')).toBeVisible();
  await page.getByTestId('continue-btn').click();
  const phase = await page.evaluate(() => window.__paint.phase());
  expect(phase).toBe('playing');
});

test('real input: mouse drag steers; desktop 1440x900 + mobile 390x844 screenshots', async ({ page }) => {
  // Desktop screenshot
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__paint !== 'undefined');
  await page.getByTestId('start-btn').click();
  await page.waitForTimeout(300);

  const canvas = page.getByTestId('game-canvas');
  const box = await canvas.boundingBox();
  if (box) {
    // drag left then right to steer
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.8);
    await page.waitForTimeout(300);
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.8);
    await page.waitForTimeout(300);
    await page.mouse.up();
  }
  await page.screenshot({ path: path.join(ARTIFACTS, 'real-input-desktop.png') });

  // Mobile screenshot
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__paint !== 'undefined');
  await page.getByTestId('start-btn').click();
  await page.waitForTimeout(300);

  const box2 = await canvas.boundingBox();
  if (box2) {
    await page.mouse.move(box2.x + box2.width * 0.5, box2.y + box2.height * 0.8);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width * 0.3, box2.y + box2.height * 0.8);
    await page.waitForTimeout(250);
    await page.mouse.move(box2.x + box2.width * 0.7, box2.y + box2.height * 0.8);
    await page.waitForTimeout(250);
    await page.mouse.up();
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACTS, 'real-input-mobile.png') });

  const pct = await page.evaluate(() => window.__paint.pct());
  expect(pct).toBeGreaterThan(0);
});
