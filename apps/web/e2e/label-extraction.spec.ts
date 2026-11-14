import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createProfile, register } from './helpers';

const label = (file: string): string =>
  fileURLToPath(new URL(`../../../packages/shared/fixtures/labels/${file}`, import.meta.url));

test('photo path: consent, upload, confirm and edit each reading, then see results', async ({
  page,
}) => {
  await register(page);
  await createProfile(page, 'Mum');
  await page
    .getByRole('link', { name: /Add (the first )?medicine/ })
    .first()
    .click();
  await page.getByRole('tab', { name: 'Use a photo' }).click();

  // Consent comes first and says where photos go and that they are not stored.
  await expect(page.getByRole('heading', { name: 'Before you add a photo' })).toBeVisible();
  await expect(
    page
      .getByText(
        'Photos you add are sent to the configured label-reading provider to read the text. MedMap does not store your photos.',
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page
    .getByTestId('photo-input')
    .setInputFiles([
      label('label-01-demolol.png'),
      label('label-02-samplifen.png'),
      label('label-06-smudged.png'),
    ]);

  // First reading: shown for checking, nothing saved yet.
  await expect(page.getByText('Reading 1 of 3, from photo 1')).toBeVisible();
  await expect(page.getByTestId('raw-text')).toHaveText('DEMOLOL 10 mg Tablets');
  await expect(page.getByLabel('Name on the label')).toHaveValue('Demolol');
  await expect(page.getByLabel(/Strength/)).toHaveValue('10 mg');
  await expect(page.getByText('Nothing yet. Medicines you save appear here.')).toBeVisible();
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByTestId('review-name')).toHaveText('Demolol');
  await page.getByRole('button', { name: 'Save medicine' }).click();
  await expect(page.getByTestId('added-list')).toContainText('Demolol');

  // Second reading: edit the strength before saving.
  await expect(page.getByText('Reading 2 of 3, from photo 2')).toBeVisible();
  await page.getByLabel(/Strength/).fill('400 mg');
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByText('400 mg')).toBeVisible();
  await page.getByRole('button', { name: 'Save medicine' }).click();
  await expect(page.getByTestId('added-list')).toContainText('Samplifen');

  // Third reading is low confidence: flagged for a careful check; the user skips it.
  await expect(page.getByText('Reading 3 of 3, from photo 3')).toBeVisible();
  await expect(page.getByText('Check this one carefully')).toBeVisible();
  await page.getByRole('button', { name: 'Skip this one' }).click();
  await expect(page.getByRole('heading', { name: 'All readings checked' })).toBeVisible();
  await expect(page.getByTestId('added-list').getByRole('listitem')).toHaveCount(2);

  await page.getByRole('link', { name: 'See results' }).click();
  await expect(page.getByTestId('summary-line')).toContainText('1 serious, 0 moderate, 0 minor');
  await expect(page.getByTestId('flagged-list')).toContainText('Demolol');
});

test('a photo that cannot be read sends the user to manual entry', async ({ page }) => {
  await register(page);
  await createProfile(page, 'Dad');
  await page
    .getByRole('link', { name: /Add (the first )?medicine/ })
    .first()
    .click();
  await page.getByRole('tab', { name: 'Use a photo' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  // A real but blank image: it is not one of the fixture labels, so nothing is read.
  await page.getByTestId('photo-input').setInputFiles({
    name: 'blank.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    ),
  });
  await expect(page.getByRole('heading', { name: 'Nothing could be read' })).toBeVisible();
  await expect(page.getByTestId('photo-failures')).toContainText(
    'Photo 1: No medicine name could be read',
  );

  // A file that is not an image is refused before upload.
  await page.getByRole('button', { name: 'Add more photos' }).click();
  await page.getByTestId('photo-input').setInputFiles({
    name: 'notes.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7'),
  });
  await expect(page.getByRole('alert')).toContainText(
    'notes.pdf is not a JPEG, PNG or WebP photo.',
  );
});
