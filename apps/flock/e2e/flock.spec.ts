import { test, expect, Page } from '@playwright/test';
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
      start: () => void;
    };
  }
}

async function clickStart(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForFunction(() => window.__flock.phase() === 'playing');
}

test('swarm exists, delivery wins the level, next level starts', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__flock !== 'undefined');
  await clickStart(page);

  const count = await page.evaluate(() => window.__flock.count());
  expect(count).toBeGreaterThan(0);

  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  // deliveries: warp the flock into the home ring until the need is met.
  // each warp delivers the current swarm; the level-1 need (22) exceeds the
  // starting swarm (22 boids >= need 22) so one or two warps suffice
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
  await clickStart(page);
  await page.evaluate(() => window.__flock.kill());
  await expect
    .poll(async () => page.evaluate(() => window.__flock.phase()), { timeout: 5000 })
    .toBe('lost');
  await expect(page.getByTestId('result-overlay')).toBeVisible();
  await page.getByTestId('continue-btn').click();
  const count = await page.evaluate(() => window.__flock.count());
  expect(count).toBeGreaterThan(0);
});

test('mute toggle and screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__flock !== 'undefined');
  await clickStart(page);
  await page.getByLabel('Mute sounds').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-muted.png') });
});

test('real-input screenshots at 1440x900 and 390x844', async ({ browser }) => {
  // Desktop 1440x900
  const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p1 = await ctx1440.newPage();
  await p1.goto('./');
  await p1.waitForFunction(() => typeof window.__flock !== 'undefined');
  await p1.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await p1.screenshot({ path: path.join(ARTIFACTS, 'ready-desktop-1440.png') });
  await p1.click('[data-testid="start-btn"]');
  await p1.waitForTimeout(300);
  // Hold to lead flock
  await p1.mouse.move(720, 450);
  await p1.mouse.down();
  await p1.waitForTimeout(1200);
  await p1.mouse.up();
  await p1.waitForTimeout(300);
  await p1.screenshot({ path: path.join(ARTIFACTS, 'gameplay-desktop-1440.png') });
  await ctx1440.close();

  // Mobile 390x844
  const ctx390 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx390.newPage();
  await p2.goto('./');
  await p2.waitForFunction(() => typeof window.__flock !== 'undefined');
  await p2.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await p2.screenshot({ path: path.join(ARTIFACTS, 'ready-mobile-390.png') });
  await p2.click('[data-testid="start-btn"]');
  await p2.waitForTimeout(300);
  await p2.mouse.move(195, 500);
  await p2.mouse.down();
  await p2.waitForTimeout(1200);
  await p2.mouse.up();
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-390.png') });
  await ctx390.close();
});
