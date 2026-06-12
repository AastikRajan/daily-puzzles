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
      steer: (frac: number) => void;
      finish: () => void;
      crash: () => void;
      restart: (next: boolean) => void;
    };
  }
}

test('running paints the floor; finish shows stars; next level advances', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__paint !== 'undefined');

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
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__paint.crash());
  await expect(page.getByTestId('result-overlay')).toBeVisible();
  await page.getByTestId('continue-btn').click();
  const phase = await page.evaluate(() => window.__paint.phase());
  expect(phase).toBe('playing');
});

test('light theme screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__paint !== 'undefined');
  await page.getByLabel('Toggle theme').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
});
