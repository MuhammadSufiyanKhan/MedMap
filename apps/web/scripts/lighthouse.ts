import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import puppeteer from 'puppeteer-core';

/**
 * Lighthouse budget check for the landing page and a signed-in results page.
 *
 * It needs the web build and API already running (the Playwright config starts both; in
 * CI this runs after the end-to-end job's servers are up). `LIGHTHOUSE_BASE_URL` selects
 * the site, `CHROME_PATH` the browser.
 */
const BASE = process.env.LIGHTHOUSE_BASE_URL ?? 'http://127.0.0.1:4173';
const BUDGETS = { performance: 90, accessibility: 95, 'best-practices': 95 } as const;

async function prepareResultsPage(port: number): Promise<string> {
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${String(port)}` });
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  // Create an account with two flagged demo medicines through the API, from the page, so
  // the session cookies belong to this browser.
  const profileId = await page.evaluate(async () => {
    const json = { 'Content-Type': 'application/json' };
    const email = `lh-${String(Date.now())}@example.com`;
    const registered = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password: 'lighthouse check pass' }),
    });
    const { accessToken } = (await registered.json()) as { accessToken: string };
    const auth = { ...json, Authorization: `Bearer ${accessToken}` };
    const profile = (await (
      await fetch('/api/v1/profiles', {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ displayName: 'Mum' }),
      })
    ).json()) as { id: string };
    for (const [displayName, rxcui] of [
      ['Demolol', 'DEMO-0001'],
      ['Samplifen', 'DEMO-0002'],
      ['Mockstatin', 'DEMO-0004'],
    ]) {
      await fetch(`/api/v1/profiles/${profile.id}/medications`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ displayName, rxcui }),
      });
    }
    window.localStorage.setItem(
      'medmap.preferences.v1',
      JSON.stringify({
        theme: 'system',
        textSize: 'normal',
        noticeAccepted: true,
        extractionConsent: false,
      }),
    );
    return profile.id;
  });
  await page.close();
  await browser.disconnect();
  return `${BASE}/app/profiles/${profileId}/results`;
}

async function audit(name: string, url: string, port: number): Promise<string[]> {
  const result = await lighthouse(url, {
    port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: Object.keys(BUDGETS),
    // Keep the session cookie that was just created.
    disableStorageReset: true,
  });
  const failures: string[] = [];
  const metrics = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
  ]
    .map((id) => `${id}=${result?.lhr.audits[id]?.displayValue ?? '?'}`)
    .join(', ');
  process.stdout.write(`     ${name}: ${metrics}\n`);
  for (const [category, minimum] of Object.entries(BUDGETS)) {
    const score = Math.round((result?.lhr.categories[category]?.score ?? 0) * 100);
    const ok = score >= minimum;
    process.stdout.write(
      `${ok ? 'ok  ' : 'FAIL'} ${name} ${category}: ${String(score)} (budget ${String(minimum)})\n`,
    );
    if (!ok) {
      failures.push(`${name} ${category} ${String(score)} < ${String(minimum)}`);
    }
  }
  return failures;
}

async function main(): Promise<void> {
  const launchOptions = {
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    ...(process.env.CHROME_PATH === undefined ? {} : { chromePath: process.env.CHROME_PATH }),
  };
  const chrome = await launch(launchOptions);
  try {
    const resultsUrl = await prepareResultsPage(chrome.port);
    const failures = [
      ...(await audit('landing', `${BASE}/`, chrome.port)),
      ...(await audit('results', resultsUrl, chrome.port)),
    ];
    if (failures.length > 0) {
      throw new Error(`Lighthouse budgets not met: ${failures.join('; ')}`);
    }
  } finally {
    chrome.kill();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'lighthouse failed'}\n`);
  process.exit(1);
});
