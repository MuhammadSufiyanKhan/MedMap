import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/env.js';
import { testEnv } from '../helpers/config.js';

describe('loadConfig', () => {
  it('parses a valid environment with defaults', () => {
    const config = loadConfig(testEnv());
    expect(config.port).toBe(4000);
    expect(config.auth.accessTtlSeconds).toBe(900);
    expect(config.auth.cookieSecure).toBe(false);
    expect(config.apiDocsEnabled).toBe(true);
    expect(config.logLevel).toBe('silent');
  });

  it('defaults to secure cookies and hidden docs in production', () => {
    const config = loadConfig(testEnv({ NODE_ENV: 'production' }));
    expect(config.auth.cookieSecure).toBe(true);
    expect(config.apiDocsEnabled).toBe(false);
  });

  it('names the bad variable without echoing its value', () => {
    const secret = 'short-secret-value';
    try {
      loadConfig(testEnv({ JWT_ACCESS_SECRET: secret }));
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toContain('JWT_ACCESS_SECRET');
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('rejects a missing database URI', () => {
    expect(() => loadConfig(testEnv({ MONGODB_URI: undefined }))).toThrow(ConfigError);
  });

  it('requires provider settings when real extraction is enabled', () => {
    expect(() =>
      loadConfig(testEnv({ LABEL_EXTRACTION_ENABLED: 'true', LABEL_EXTRACTOR: 'anthropic' })),
    ).toThrow(/EXTRACTION_MODEL[\s\S]*EXTRACTION_API_KEY/);
  });

  it('refuses the mock extractor in production', () => {
    expect(() =>
      loadConfig(
        testEnv({
          NODE_ENV: 'production',
          LABEL_EXTRACTION_ENABLED: 'true',
          LABEL_EXTRACTOR: 'mock',
        }),
      ),
    ).toThrow(/mock extractor/);
  });

  it('requires SMTP_URL for the smtp adapter', () => {
    expect(() => loadConfig(testEnv({ EMAIL_ADAPTER: 'smtp' }))).toThrow(/SMTP_URL/);
  });
});
