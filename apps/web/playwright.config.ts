import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production web build served by `vite preview`, with a
 * real API and MongoDB behind it.
 *
 * - `E2E_BASE_URL` set: test that deployment (staging smoke tests) and start nothing.
 * - otherwise: start the API on port 4100 (database `medmap_e2e`, demo dataset, mock label
 *   extractor) and the web preview on port 4173.
 * - `PW_CHROMIUM_PATH`: use a pre-installed Chromium instead of Playwright's download.
 */
const externalBaseUrl = process.env.E2E_BASE_URL;
const apiPort = 4100;
const webPort = 4173;
const mongoBase = process.env.MONGO_TEST_URI ?? 'mongodb://127.0.0.1:27017';
const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 1 : 0,
  workers: process.env.CI !== undefined ? 2 : 3,
  reporter: process.env.CI !== undefined ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: externalBaseUrl ?? `http://127.0.0.1:${String(webPort)}`,
    trace: 'off',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: chromiumPath === undefined ? {} : { executablePath: chromiumPath },
  },
  ...(externalBaseUrl === undefined
    ? {
        webServer: [
          {
            command: 'npm run e2e:serve -w @medmap/api',
            cwd: '../..',
            url: `http://127.0.0.1:${String(apiPort)}/readyz`,
            reuseExistingServer: process.env.CI === undefined,
            timeout: 120_000,
            env: {
              NODE_ENV: 'test',
              LOG_LEVEL: 'warn',
              PORT: String(apiPort),
              MONGODB_URI: `${mongoBase.replace(/\/+$/, '')}/medmap_e2e`,
              JWT_ACCESS_SECRET: 'e2e-only-secret-e2e-only-secret-e2e-only',
              WEB_ORIGIN: `http://127.0.0.1:${String(webPort)}`,
              APP_BASE_URL: `http://127.0.0.1:${String(webPort)}`,
              ALLOW_DEMO_DATA: 'true',
              RXNORM_ENABLED: 'false',
              LABEL_EXTRACTION_ENABLED: 'true',
              LABEL_EXTRACTOR: 'mock',
              RATE_LIMIT_GENERAL_MAX: '100000',
              RATE_LIMIT_AUTH_MAX: '100000',
              RATE_LIMIT_EXTRACTION_MAX: '100000',
              EXTRACTION_DAILY_CAP: '1000',
            },
          },
          {
            command: `npx vite preview --host 127.0.0.1 --port ${String(webPort)} --strictPort`,
            url: `http://127.0.0.1:${String(webPort)}`,
            reuseExistingServer: process.env.CI === undefined,
            timeout: 60_000,
            env: { VITE_DEV_API_PROXY: `http://127.0.0.1:${String(apiPort)}` },
          },
        ],
      }
    : {}),
});
