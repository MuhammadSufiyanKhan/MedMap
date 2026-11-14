import { expect, test } from '@playwright/test';
import { addMedicine, createProfile, register } from './helpers';

test('register, create a profile, add two medicines, see the flagged pair in list, graph and table', async ({
  page,
}) => {
  await register(page);

  // The demo banner is present on every signed-in page.
  await expect(page.getByRole('note', { name: 'Demo data' })).toContainText('DEMO DATA');

  await createProfile(page, 'Mum');
  await page
    .getByRole('link', { name: /Add (the first )?medicine/ })
    .first()
    .click();
  await addMedicine(page, 'Demolol');
  await addMedicine(page, 'Samplifen');
  await page.getByRole('link', { name: 'See results' }).click();

  // Ranked list first.
  await expect(page.getByRole('heading', { name: 'Results for Mum' })).toBeVisible();
  await expect(page.getByTestId('summary-line')).toContainText('1 serious, 0 moderate, 0 minor');
  const flagged = page.getByTestId('flagged-list');
  await expect(flagged.getByRole('listitem')).toHaveCount(1);
  await expect(flagged).toContainText('Demolol');
  await expect(flagged).toContainText('Samplifen');
  await expect(flagged).toContainText('Serious');
  await expect(flagged).toContainText('Ask your pharmacist or prescriber about this combination.');
  await expect(page.getByTestId('dataset-attribution')).toContainText(
    'Source: MedMap demo set, version 1.0.0',
  );
  await expect(
    page.getByText('For urgent symptoms, contact your local emergency services.').first(),
  ).toBeVisible();

  // Graph second: one labelled line between the two medicines.
  await page.getByRole('tab', { name: 'Graph' }).click();
  const graph = page.getByTestId('interaction-graph');
  await expect(graph).toBeVisible();
  await expect(graph.locator('[data-graph-node]')).toHaveCount(2);
  await expect(graph.getByText('Serious')).toBeVisible();

  // Table alternative.
  await page.getByRole('tab', { name: 'Table' }).click();
  const table = page.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('demo:pair-001');
});

test('an unmatched medicine is saved, shown as could not check and counted', async ({ page }) => {
  await register(page);
  await createProfile(page, 'Dad');
  await page
    .getByRole('link', { name: /Add (the first )?medicine/ })
    .first()
    .click();
  await addMedicine(page, 'Demolol');
  await addMedicine(page, 'Granny herbal blend', { match: false });
  await page.getByRole('link', { name: 'See results' }).click();

  await expect(page.getByTestId('unchecked-summary')).toContainText(
    '1 medicine could not be checked',
  );
  await expect(page.getByTestId('unchecked-list')).toContainText('Granny herbal blend');
  await expect(page.getByTestId('no-flags')).toContainText(
    'No known interaction found in this source',
  );
});

test('the results page never uses the word "safe"', async ({ page }) => {
  await register(page);
  await createProfile(page, 'Aunt');
  await page
    .getByRole('link', { name: /Add (the first )?medicine/ })
    .first()
    .click();
  await addMedicine(page, 'Placebex');
  await addMedicine(page, 'Trialcillin');
  await page.getByRole('link', { name: 'See results' }).click();
  await expect(page.getByTestId('no-flags')).toBeVisible();

  for (const tab of ['List', 'Graph', 'Table']) {
    await page.getByRole('tab', { name: tab }).click();
    const text = (await page.locator('body').innerText()).toLowerCase();
    expect(text).not.toMatch(/\b(safe|unsafe|harmless)\b/);
  }
  // No line is drawn for the unflagged pair.
  await page.getByRole('tab', { name: 'Graph' }).click();
  await expect(page.getByTestId('interaction-graph').locator('.react-flow__edge')).toHaveCount(0);
});

test('sign out clears the session and protects app pages', async ({ page }) => {
  await register(page);
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login$/);
});
