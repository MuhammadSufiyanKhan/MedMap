import { z } from 'zod';

const booleanFlag = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const csv = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? undefined : value.trim()));

/**
 * Every environment variable the API reads. The process refuses to start when this fails,
 * so a misconfigured deployment is caught at boot and not on the first request.
 * Keep this in sync with `.env.example` and the README table (checked in CI).
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'Must be a MongoDB connection string'),
  JWT_ACCESS_SECRET: z.string().min(32, 'Use at least 32 random characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  WEB_ORIGIN: csv.default(['http://localhost:5173']),
  APP_BASE_URL: z.url().default('http://localhost:5173'),
  COOKIE_SECURE: booleanFlag,
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  ALLOW_DEMO_DATA: booleanFlag,
  API_DOCS_ENABLED: booleanFlag,
  RATE_LIMIT_GENERAL_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_EXTRACTION_MAX: z.coerce.number().int().min(1).default(10),
  RXNORM_ENABLED: booleanFlag,
  RXNORM_BASE_URL: z.url().default('https://rxnav.nlm.nih.gov/REST'),
  LABEL_EXTRACTION_ENABLED: booleanFlag,
  LABEL_EXTRACTOR: z.enum(['mock', 'ollama', 'anthropic']).default('mock'),
  EXTRACTION_BASE_URL: optionalString,
  EXTRACTION_MODEL: optionalString,
  EXTRACTION_API_KEY: optionalString,
  EXTRACTION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
  EXTRACTION_DAILY_CAP: z.coerce.number().int().min(1).max(1000).default(20),
  EMAIL_ADAPTER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().default('MedMap <no-reply@localhost>'),
  SMTP_URL: optionalString,
  SENTRY_DSN: optionalString,
});

type RawEnv = z.infer<typeof envSchema>;

/** Validated runtime configuration, grouped by concern. */
export interface AppConfig {
  nodeEnv: RawEnv['NODE_ENV'];
  isProduction: boolean;
  port: number;
  logLevel: RawEnv['LOG_LEVEL'];
  mongoUri: string;
  auth: {
    accessSecret: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
    cookieSecure: boolean;
  };
  webOrigins: string[];
  appBaseUrl: string;
  trustProxy: number;
  allowDemoData: boolean;
  apiDocsEnabled: boolean;
  rateLimit: { generalMax: number; authMax: number; extractionMax: number };
  rxnorm: { enabled: boolean; baseUrl: string };
  extraction: {
    enabled: boolean;
    adapter: RawEnv['LABEL_EXTRACTOR'];
    baseUrl: string | undefined;
    model: string | undefined;
    apiKey: string | undefined;
    timeoutMs: number;
    dailyCap: number;
  };
  email: { adapter: RawEnv['EMAIL_ADAPTER']; from: string; smtpUrl: string | undefined };
  sentryDsn: string | undefined;
}

/** Thrown when the environment is not valid. The message lists variable names, never values. */
export class ConfigError extends Error {
  public constructor(problems: string[]) {
    super(`Invalid environment configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

/**
 * Parses and validates environment variables.
 * @throws ConfigError listing each problem by variable name. Values are never included,
 * so a bad secret cannot end up in logs.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }
  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';
  const problems: string[] = [];

  if (env.EMAIL_ADAPTER === 'smtp' && env.SMTP_URL === undefined) {
    problems.push('SMTP_URL: required when EMAIL_ADAPTER=smtp');
  }
  if (env.LABEL_EXTRACTION_ENABLED && env.LABEL_EXTRACTOR !== 'mock') {
    if (env.EXTRACTION_MODEL === undefined) {
      problems.push('EXTRACTION_MODEL: required when label extraction uses a real provider');
    }
    if (env.LABEL_EXTRACTOR === 'anthropic' && env.EXTRACTION_API_KEY === undefined) {
      problems.push('EXTRACTION_API_KEY: required when LABEL_EXTRACTOR=anthropic');
    }
    if (env.LABEL_EXTRACTOR === 'ollama' && env.EXTRACTION_BASE_URL === undefined) {
      problems.push('EXTRACTION_BASE_URL: required when LABEL_EXTRACTOR=ollama');
    }
  }
  if (isProduction && env.LABEL_EXTRACTION_ENABLED && env.LABEL_EXTRACTOR === 'mock') {
    problems.push('LABEL_EXTRACTOR: the mock extractor cannot be used in production');
  }
  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return {
    nodeEnv: env.NODE_ENV,
    isProduction,
    port: env.PORT,
    logLevel: env.NODE_ENV === 'test' && source.LOG_LEVEL === undefined ? 'silent' : env.LOG_LEVEL,
    mongoUri: env.MONGODB_URI,
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      cookieSecure: source.COOKIE_SECURE === undefined ? isProduction : env.COOKIE_SECURE,
    },
    webOrigins: env.WEB_ORIGIN,
    appBaseUrl: env.APP_BASE_URL.replace(/\/$/, ''),
    trustProxy: env.TRUST_PROXY,
    allowDemoData: env.ALLOW_DEMO_DATA,
    apiDocsEnabled: source.API_DOCS_ENABLED === undefined ? !isProduction : env.API_DOCS_ENABLED,
    rateLimit: {
      generalMax: env.RATE_LIMIT_GENERAL_MAX,
      authMax: env.RATE_LIMIT_AUTH_MAX,
      extractionMax: env.RATE_LIMIT_EXTRACTION_MAX,
    },
    rxnorm: {
      enabled: source.RXNORM_ENABLED === undefined ? true : env.RXNORM_ENABLED,
      baseUrl: env.RXNORM_BASE_URL.replace(/\/$/, ''),
    },
    extraction: {
      enabled: env.LABEL_EXTRACTION_ENABLED,
      adapter: env.LABEL_EXTRACTOR,
      baseUrl: env.EXTRACTION_BASE_URL?.replace(/\/$/, ''),
      model: env.EXTRACTION_MODEL,
      apiKey: env.EXTRACTION_API_KEY,
      timeoutMs: env.EXTRACTION_TIMEOUT_MS,
      dailyCap: env.EXTRACTION_DAILY_CAP,
    },
    email: { adapter: env.EMAIL_ADAPTER, from: env.EMAIL_FROM, smtpUrl: env.SMTP_URL },
    sentryDsn: env.SENTRY_DSN,
  };
}
