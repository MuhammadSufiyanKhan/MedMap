import { loadConfig } from '../../src/config/env.js';
import type { AppConfig } from '../../src/config/env.js';

/** Environment used by tests. Rate limits are high so suites do not trip them by accident. */
export function testEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/medmap_test',
    JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-test',
    WEB_ORIGIN: 'http://localhost:5173',
    APP_BASE_URL: 'http://localhost:5173',
    RATE_LIMIT_GENERAL_MAX: '100000',
    RATE_LIMIT_AUTH_MAX: '100000',
    RATE_LIMIT_EXTRACTION_MAX: '100000',
    RXNORM_ENABLED: 'false',
    ALLOW_DEMO_DATA: 'true',
    ...overrides,
  };
}

export function testConfig(overrides: Record<string, string | undefined> = {}): AppConfig {
  return loadConfig(testEnv(overrides));
}
