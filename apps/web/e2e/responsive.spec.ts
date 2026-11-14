import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addMedicine, createProfile, hasHorizontalOverflow, register } from './helpers';

/**
 * Screenshots of the main screens at the four supported widths. Each one fails when the
 * page is wider than the viewport. Images land in `e2e/screenshots/` for review.
 */
const WIDTHS = [360, 768, 1024, 1440] as const;
const OUT = 'e2e/screenshots';

// Screenshots show settled pages: animations are covered by motion.spec.ts.
test.use({ reducedMotion: 'reduce' });
mkdirSync(OUT, { recursive: true });

async function capture(page: Page, name: string, width: number): Promise<void> {
  await page.waitForLoadState('networkidle');
  expect(await hasHorizontalOverflow(page), `${name} overflows at ${String(width)}px`).toBe(false);
  await page.screenshot({ path: `${OUT}/${name}-${String(width)}.png`, fullPage: true });
}

for (const width of WIDTHS) {
  test.describe(`at ${String(width)}px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 740 : 900 } });

    test('public pages fit the viewport', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await capture(page, 'landing', width);
      await page.goto('/login');
      await capture(page, 'login', width);
      await page.goto('/register');
      await capture(page, 'register', width);
    });

    test('signed-in pages fit the viewport', async ({ page }) => {
      await register(page);
      await capture(page, 'dashboard-empty', width);
      await createProfile(page, 'Mum');
      await page
        .getByRole('link', { name: /Add (the first )?medicine/ })
        .first()
        .click();
      await capture(page, 'add-medicine', width);
      await addMedicine(page, 'Demopress');
      await addMedicine(page, 'Duoflex (Samplifen / Testazole)');
      await addMedicine(page, 'Mockstatin');
      await addMedicine(page, 'A very long unmatched herbal product name from the market', {
        match: false,
      });
      await page.getByRole('button', { name: 'Back to the list' }).click();
      await expect(page.getByTestId('medication-list')).toBeVisible();
      await capture(page, 'profile', width);

      await page.getByRole('link', { name: 'See results' }).click();
      await expect(page.getByTestId('flagged-list')).toBeVisible();
      await capture(page, 'results-list', width);
      await page.getByRole('tab', { name: 'Graph' }).click();
      await expect(page.getByTestId('interaction-graph').locator('[data-graph-node]')).toHaveCount(
        4,
      );
      await capture(page, 'results-graph', width);
      await page.getByLabel('Focus on one medicine').selectOption({ label: 'Mockstatin' });
      await expect(page.getByTestId('interaction-graph').locator('[data-graph-node]')).toHaveCount(
        3,
      );
      await capture(page, 'results-graph-focus', width);
      await page.getByRole('tab', { name: 'Table' }).click();
      await capture(page, 'results-table', width);

      await page.getByRole('link', { name: 'Page for your pharmacist' }).click();
      await expect(page.getByRole('heading', { name: 'Medicine list for Mum' })).toBeVisible();
      await capture(page, 'print', width);

      await page.goto('/app/settings');
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      await capture(page, 'settings', width);
    });
  });
}

test('the navigation is a bottom bar on phones and a side rail on wide screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await register(page);
  await expect(page.getByTestId('bottom-nav')).toBeVisible();
  await expect(page.getByTestId('side-nav')).toBeHidden();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.getByTestId('side-nav')).toBeVisible();
  await expect(page.getByTestId('bottom-nav')).toBeHidden();
});

test('touch targets in the bottom bar are at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await register(page);
  for (const item of await page.getByTestId('bottom-nav').locator('a, button').all()) {
    const box = await item.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('large-text mode and themes apply to the document', async ({ page }) => {
  await register(page);
  await page.goto('/app/settings');
  await page.getByLabel('Text size').selectOption('large');
  await expect(page.locator('html')).toHaveAttribute('data-text', 'large');
  await page.getByLabel('Theme').selectOption('contrast');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'contrast');
  expect(await hasHorizontalOverflow(page)).toBe(false);
});
