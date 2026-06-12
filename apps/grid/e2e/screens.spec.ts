/**
 * Screenshot gallery — Daily Grid.
 * Captures home, each puzzle, settings, and stats in light/dark on two sizes.
 */
import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', '..', '..', 'artifacts', 'grid');

const SIZES = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

const THEMES = ['light', 'dark'] as const;

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

for (const size of SIZES) {
  for (const theme of THEMES) {
    test(`gallery ${size.name} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: theme });

      await page.goto('/');
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `home-${size.name}-${theme}.png`) });

      // Queens
      await page.getByTestId('card-queens').click();
      await page.waitForSelector('[data-testid="queens-grid"]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, `queens-${size.name}-${theme}.png`) });
      await page.getByTestId('back-home').click();

      // Tango
      await page.getByTestId('card-tango').click();
      await page.waitForSelector('[data-testid="tango-grid"]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, `tango-${size.name}-${theme}.png`) });
      await page.getByTestId('back-home').click();

      // Zip
      await page.getByTestId('card-zip').click();
      await page.waitForSelector('[data-testid="zip-grid"]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, `zip-${size.name}-${theme}.png`) });
      await page.getByTestId('back-home').click();

      // Settings
      await page.getByTestId('nav-settings').click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(OUT, `settings-${size.name}-${theme}.png`) });
      await page.getByTestId('back-home').click();

      // Stats
      await page.getByTestId('nav-stats').click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: join(OUT, `stats-${size.name}-${theme}.png`) });
    });
  }
}
