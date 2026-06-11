import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Screenshot gallery for the visual review loop. Writes to /artifacts.
 * Run: npx playwright test e2e/screens.spec.ts
 */
const SIZES = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const THEMES = ['light', 'dark'] as const;

const OUT = '../../artifacts/screens';

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

for (const size of SIZES) {
  for (const theme of THEMES) {
    test(`gallery ${size.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: theme });

      await page.goto('/');
      await page.waitForTimeout(400); // fonts settle
      await page.screenshot({ path: `${OUT}/home-${size.name}-${theme}.png` });

      await page.getByTestId('card-sudoku').click();
      await page.waitForSelector('[data-testid="sudoku-grid"]');
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/sudoku-${size.name}-${theme}.png` });

      await page.getByTestId('back-home').click();
      await page.getByTestId('nav-settings').click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/settings-${size.name}-${theme}.png` });

      await page.getByTestId('back-home').click();
      await page.getByTestId('nav-stats').click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${OUT}/stats-${size.name}-${theme}.png` });
    });
  }
}
