import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'golf');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __golf: {
      hole: () => number;
      strokes: () => number[];
      shoot: (angleRad: number, power01: number) => void;
      ballAt: () => { x: number; y: number };
      holeAt: () => { x: number; y: number };
      skipHole: () => void;
      phase: () => string;
      ballStatus: () => string;
    };
  }
}

test('sink hole 1 by aiming at the cup, then finish the round and share', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__golf !== 'undefined');
  await page.getByTestId('start-btn').click();
  // dismiss intro banner
  await page.waitForTimeout(2000);

  // shoot toward the cup (same greedy heuristic the generator's
  // completability check uses), waiting for the ball to stop between shots
  const waitForBallStop = async () => {
    for (let i = 0; i < 25; i++) {
      const p1 = await page.evaluate(() => window.__golf.ballAt());
      await page.waitForTimeout(400);
      const p2 = await page.evaluate(() => window.__golf.ballAt());
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < 0.5) return;
    }
  };

  for (let shot = 0; shot < 10; shot++) {
    const sunk = await page.evaluate(() => window.__golf.hole() > 0);
    if (sunk) break;
    await page.evaluate(() => {
      const g = window.__golf;
      const b = g.ballAt();
      const h = g.holeAt();
      const angle = Math.atan2(h.y - b.y, h.x - b.x);
      const dist = Math.hypot(h.x - b.x, h.y - b.y);
      g.shoot(angle, Math.min(dist / 200, 1));
    });
    await page.waitForTimeout(500);
    await waitForBallStop();
    await page.waitForTimeout(600); // sink animation / banner transition
  }

  const holeAfter = await page.evaluate(() => window.__golf.hole());
  expect(holeAfter, 'hole 1 should be sunk within 8 aimed shots').toBeGreaterThan(0);

  // gameplay screenshot on hole 2 with banner gone
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  // skip through the rest
  for (let i = 0; i < 9; i++) {
    const done = await page.evaluate(() => window.__golf.hole());
    if (done >= 9) break;
    await page.evaluate(() => window.__golf.skipHole());
    await page.waitForTimeout(350);
  }

  await expect(page.getByTestId('scorecard')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('score-rows')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'scorecard-mobile-dark.png') });

  await page.getByTestId('share').click();
  await expect(page.getByTestId('share')).toContainText(/Copied!|Shared!/);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Glow Golf');
});

test('light theme gameplay screenshot', async ({ page }) => {
  await page.goto('./');
  await page.waitForFunction(() => typeof window.__golf !== 'undefined');
  await page.getByTestId('start-btn').click();
  await page.getByTestId('theme-toggle').click();
  await page.waitForTimeout(2200); // banner out
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-light.png') });
});
