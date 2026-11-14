import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { addMedicine, createProfile, register } from './helpers';

async function expectNoViolations(page: Page, name: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // React Flow's own pan/zoom viewport is covered by the table alternative.
    .exclude('.react-flow__attribution')
    .analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => node.target.join(' ')).slice(0, 3),
  }));
  expect(summary, `axe violations on ${name}`).toEqual([]);
}

test.use({ reducedMotion: 'reduce' });

for (const theme of ['light', 'dark', 'contrast'] as const) {
  test(`public pages have no axe violations (${theme})`, async ({ page }) => {
    await page.addInitScript((value) => {
      window.localStorage.setItem(
        'medmap.preferences.v1',
        JSON.stringify({
          theme: value,
          textSize: 'normal',
          noticeAccepted: false,
          extractionConsent: false,
        }),
      );
    }, theme);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expectNoViolations(page, `landing ${theme}`);
    await page.goto('/login');
    await expectNoViolations(page, `login ${theme}`);
    await page.goto('/register');
    await expectNoViolations(page, `register ${theme}`);
  });
}

test('signed-in pages have no axe violations', async ({ page }) => {
  await page.goto('/register');
  await register(page);
  await expectNoViolations(page, 'dashboard');
  await createProfile(page, 'Mum');
  await page
    .getByRole('link', { name: /Add (the first )?medicine/ })
    .first()
    .click();
  await page.getByLabel('Name on the label').fill('Demolol');
  await expect(page.getByRole('radio').first()).toBeVisible();
  await expectNoViolations(page, 'add medicine');
  await addMedicine(page, 'Demolol');
  await addMedicine(page, 'Samplifen');
  await addMedicine(page, 'Unknown herbal blend', { match: false });
  await page.getByRole('button', { name: 'Back to the list' }).click();
  await expectNoViolations(page, 'profile');
  await page.getByRole('link', { name: 'See results' }).click();
  await expect(page.getByTestId('flagged-list')).toBeVisible();
  await expectNoViolations(page, 'results list');
  await page.getByRole('tab', { name: 'Graph' }).click();
  await expect(page.getByTestId('interaction-graph').locator('[data-graph-node]')).toHaveCount(3);
  await expectNoViolations(page, 'results graph');
  await page.getByRole('tab', { name: 'Table' }).click();
  await expectNoViolations(page, 'results table');
  await page.getByRole('link', { name: 'Page for your pharmacist' }).click();
  await expect(page.getByRole('heading', { name: 'Medicine list for Mum' })).toBeVisible();
  await expectNoViolations(page, 'print');
  await page.goto('/app/settings');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expectNoViolations(page, 'settings');
});

test('the first-run notice traps focus and cannot be dismissed with Escape', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill(`focus-${String(Date.now())}@example.com`);
  await page.getByLabel('Password').fill('correct horse battery');
  await page.getByRole('button', { name: 'Create account' }).click();
  const dialog = page.getByRole('dialog', { name: 'Before you start' });
  await expect(dialog).toBeVisible();
  await expectNoViolations(page, 'first-run notice');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'I understand' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
});

test('results tabs work from the keyboard', async ({ page }) => {
  await register(page);
  await createProfile(page, 'Mum');
  await page.getByRole('link', { name: 'See results' }).click();
  await page.getByRole('link', { name: 'Add a medicine' }).waitFor();
  await page.goBack();
  await page
    .getByRole('link', { name: /Add (the first )?medicine/ })
    .first()
    .click();
  await addMedicine(page, 'Demolol');
  await addMedicine(page, 'Samplifen');
  await page.getByRole('link', { name: 'See results' }).click();
  await page.getByRole('tab', { name: 'List' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Graph' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Table' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('table')).toBeVisible();
});
