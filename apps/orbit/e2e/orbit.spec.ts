import { test, expect, type Page } from '@playwright/test';
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
      start: () => void;
      placeStarOnPath: () => void;
    };
  }
}

async function clickStart(page: Page) {
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForFunction(() => window.__orbit?.phase() === 'playing');
}

test('hopping changes rings, stars score, death + restart work', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__orbit !== 'undefined');
  await clickStart(page);

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
  await clickStart(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
});

test('real-input screenshots at 1440x900 and 390x844', async ({ browser }) => {
  // Desktop 1440x900
  const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page1440 = await ctx1440.newPage();
  await page1440.goto('./');
  await page1440.waitForFunction(() => typeof window.__orbit !== 'undefined');
  await page1440.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await page1440.screenshot({ path: path.join(ARTIFACTS, 'ready-desktop-1440.png') });
  await page1440.click('[data-testid="start-btn"]');
  await page1440.waitForTimeout(600);
  // tap center to hop
  await page1440.mouse.click(720, 450);
  await page1440.waitForTimeout(400);
  await page1440.screenshot({ path: path.join(ARTIFACTS, 'gameplay-desktop-1440.png') });
  await ctx1440.close();

  // Mobile 390x844
  const ctx390 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page390 = await ctx390.newPage();
  await page390.goto('./');
  await page390.waitForFunction(() => typeof window.__orbit !== 'undefined');
  await page390.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await page390.screenshot({ path: path.join(ARTIFACTS, 'ready-mobile-390.png') });
  await page390.click('[data-testid="start-btn"]');
  await page390.waitForTimeout(600);
  await page390.mouse.click(195, 422);
  await page390.waitForTimeout(400);
  await page390.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-390.png') });
  await ctx390.close();
});
