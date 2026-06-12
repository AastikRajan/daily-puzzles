import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { utcDateString } from '@daily-logic/engine';
import { dailyMaze, solveMaze } from '../src/engine/maze';

const here = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = path.join(here, '..', '..', '..', 'artifacts', 'maze');

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
});

declare global {
  interface Window {
    __maze: {
      pos: () => number;
      phase: () => string;
      bumps: () => number;
      move: (d: number) => void;
      echo: () => void;
      skipReveal: () => void;
    };
  }
}

test('reveal phase shows, then walk the BFS solution to escape and share', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const maze = dailyMaze(utcDateString());
  const solution = solveMaze(maze);

  await page.goto('./');
  await expect(page.getByTestId('start-overlay')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'title-mobile-dark.png') });
  await page.getByTestId('start-btn').click();
  await expect(page.getByTestId('reveal-tag')).toBeVisible();
  await page.screenshot({ path: path.join(ARTIFACTS, 'reveal-mobile-dark.png') });

  await page.waitForFunction(() => typeof window.__maze !== 'undefined');
  await page.evaluate(() => window.__maze.skipReveal());
  await page.waitForTimeout(300);

  // one deliberate bump: try a walled direction from start (find one)
  const walled = [0, 1, 2, 3].find((d) => (maze.walls[maze.start]! & [1, 2, 4, 8][d]!) !== 0)!;
  await page.evaluate((d) => window.__maze.move(d), walled);
  await page.waitForTimeout(150);
  const bumps = await page.evaluate(() => window.__maze.bumps());
  expect(bumps).toBe(1);

  // use an echo pulse
  await page.evaluate(() => window.__maze.echo());
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(ARTIFACTS, 'gameplay-mobile-dark.png') });

  // walk the solution
  for (const dir of solution) {
    await page.evaluate((d) => window.__maze.move(d), dir);
    await page.waitForTimeout(40);
  }
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: path.join(ARTIFACTS, 'won-mobile-dark.png') });

  await page.getByTestId('share').click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Echo Maze');
  expect(clip).toContain('💥 1 bumps');
});

test('light theme screenshot', async ({ page }) => {
  await page.goto('./');
  await page.getByLabel('Toggle theme').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACTS, 'reveal-mobile-light.png') });
});
