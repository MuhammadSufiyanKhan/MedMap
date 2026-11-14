import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const PASSWORD = 'correct horse battery';

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/** Creates an account through the UI and accepts the first-run notice. */
export async function register(page: Page, email = uniqueEmail()): Promise<string> {
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('dialog', { name: 'Before you start' })).toBeVisible();
  await page.getByRole('button', { name: 'I understand' }).click();
  await expect(page.getByRole('heading', { name: 'Profiles', level: 1 })).toBeVisible();
  return email;
}

export async function createProfile(page: Page, name: string): Promise<void> {
  await page
    .getByRole('button', { name: /New profile|Create the first profile/ })
    .first()
    .click();
  await page.getByLabel('Who is this list for?').fill(name);
  await page.getByRole('button', { name: 'Create profile' }).click();
  await page.getByRole('link', { name: new RegExp(`^${name},`) }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
}

/** Adds one medicine by typing its name and picking the first match. Starts on the add page. */
export async function addMedicine(
  page: Page,
  name: string,
  options: { match?: boolean } = {},
): Promise<void> {
  await page.getByLabel('Name on the label').fill(name);
  if (options.match !== false) {
    await page.getByRole('radio').first().check();
  }
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Check before saving' })).toBeVisible();
  await expect(page.getByTestId('review-name')).toHaveText(name);
  await page.getByRole('button', { name: 'Save medicine' }).click();
  await expect(page.getByTestId('added-list')).toContainText(name);
}

/** True when the page is wider than the viewport, which would mean horizontal scrolling. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
}
