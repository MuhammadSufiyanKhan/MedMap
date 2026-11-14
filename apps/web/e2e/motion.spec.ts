import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions for the life of the page. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return errors;
}

/** Elements that are in the layout but invisible or shifted by an animation start state. */
async function hiddenOrMoved(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selectors =
      '[data-hero-text], [data-node], [data-edge], [data-edge-label], [data-reveal]';
    return [...document.querySelectorAll<HTMLElement | SVGElement>(selectors)]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          Number(style.opacity) < 1 ||
          (style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)')
        );
      })
      .map((element) => element.outerHTML.slice(0, 80));
  });
}

test.describe('with prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the landing page shows everything at once with no movement', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Checked immediately: nothing may be mid-animation or waiting for a scroll trigger.
    expect(await hiddenOrMoved(page)).toEqual([]);
    await expect(
      page.getByRole('heading', { name: 'Three steps, about five minutes' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What MedMap does not do' })).toBeVisible();

    // No pinning: the page scrolls normally and no pin spacer is inserted.
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    expect(await hiddenOrMoved(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('with motion allowed', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('animations finish with content visible, and scrolling back and forth leaves no errors', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Safety text is outside the animated set and is visible from the first frame.
    await expect(page.getByText('MedMap is an information tool.').first()).toBeVisible();

    for (let pass = 0; pass < 2; pass += 1) {
      for (let y = 0; y <= 6000; y += 400) {
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(40);
      }
      for (let y = 0; y <= 6000; y += 400) {
        await page.mouse.wheel(0, -400);
        await page.waitForTimeout(40);
      }
    }
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(1500);
    expect(await hiddenOrMoved(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('resizing and navigating away and back leaves no stale triggers or errors', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.locator('.pin-spacer')).toHaveCount(1);
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator('.pin-spacer')).toHaveCount(1);

    await page.getByRole('link', { name: 'Sign in' }).first().click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.pin-spacer')).toHaveCount(1);
    // Let the hero finish, then scroll through so every scroll-triggered reveal has run.
    await page.waitForTimeout(3000);
    for (let y = 0; y <= 6000; y += 400) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(1500);
    expect(await hiddenOrMoved(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('content is readable when JavaScript is blocked from animating', async ({ page }) => {
    // If the animation library fails to load, nothing in CSS hides the content.
    await page.route('**/*hooks*.js', (route) => route.abort());
    await page.goto('/');
    const hiddenByCss = await page.evaluate(
      () =>
        [...document.querySelectorAll('body *')].filter(
          (element) => getComputedStyle(element).opacity === '0',
        ).length,
    );
    expect(hiddenByCss).toBe(0);
  });
});
