import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'swing');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __swing: {
      distance: () => number;
      stars: () => number;
      phase: () => string;
      attach: () => void;
      release: () => void;
      attached: () => boolean;
      restart: () => void;
      start: () => void;
    };
  }
}

async function clickStart(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForFunction(() => window.__swing?.phase() === 'playing');
}

test('swinging makes progress; falling dies; restart works', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('game-canvas')).toBeVisible();
  await page.waitForFunction(() => typeof window.__swing !== 'undefined');

  await clickStart(page);

  // rhythmic swings: attach, ride the pendulum, release on the upswing
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.__swing.attach());
    await page.waitForTimeout(620);
    if (i === 2) {
      await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });
    }
    await page.evaluate(() => window.__swing.release());
    await page.waitForTimeout(260);
    if ((await page.evaluate(() => window.__swing.phase())) === 'dead') break;
  }

  // either we made distance or died trying — but distance must have advanced
  const dist = await page.evaluate(() => window.__swing.distance());
  expect(dist).toBeGreaterThan(3);

  // let gravity finish the job for the death overlay
  for (let i = 0; i < 20; i++) {
    const phase = await page.evaluate(() => window.__swing.phase());
    if (phase === 'dead') break;
    await page.evaluate(() => window.__swing.release());
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId('game-over-overlay')).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameover-mobile-dark.png') });

  await page.getByTestId('play-again-btn').click();
  await expect(page.getByTestId('game-over-overlay')).not.toBeVisible();
  const d2 = await page.evaluate(() => window.__swing.distance());
  expect(d2).toBeLessThan(5);
});

test('mute toggle and screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__swing !== 'undefined');
  await page.waitForSelector('[data-testid="start-btn"]');
  await page.click('[data-testid="start-btn"]');
  await page.waitForFunction(() => window.__swing?.phase() === 'playing');
  await page.getByLabel('Mute').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-muted.png') });
});

test('real-input screenshots at 1440x900 and 390x844', async ({ browser }) => {
  // Desktop 1440x900
  const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p1 = await ctx1440.newPage();
  await p1.goto('./');
  await p1.waitForFunction(() => typeof window.__swing !== 'undefined');
  await p1.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await p1.screenshot({ path: path.join(ARTIFACTS, 'ready-desktop-1440.png') });
  await p1.click('[data-testid="start-btn"]');
  await p1.waitForFunction(() => window.__swing?.phase() === 'playing');
  await p1.waitForTimeout(400);
  // Hold to latch rope
  await p1.mouse.down();
  await p1.waitForTimeout(700);
  await p1.mouse.up();
  await p1.waitForTimeout(500);
  await p1.screenshot({ path: path.join(ARTIFACTS, 'gameplay-desktop-1440.png') });
  await ctx1440.close();

  // Mobile 390x844
  const ctx390 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2 = await ctx390.newPage();
  await p2.goto('./');
  await p2.waitForFunction(() => typeof window.__swing !== 'undefined');
  await p2.waitForSelector('[data-testid="start-btn"]', { state: 'visible' });
  await p2.screenshot({ path: path.join(ARTIFACTS, 'ready-mobile-390.png') });
  await p2.click('[data-testid="start-btn"]');
  await p2.waitForFunction(() => window.__swing?.phase() === 'playing');
  await p2.waitForTimeout(400);
  await p2.mouse.down();
  await p2.waitForTimeout(700);
  await p2.mouse.up();
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-390.png') });
  await ctx390.close();
});
