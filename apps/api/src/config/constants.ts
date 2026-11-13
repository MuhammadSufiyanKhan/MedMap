/** Prefix for every versioned API route. A breaking change means a new prefix. */
export const API_PREFIX = '/api/v1';

/** Base URI for RFC 7807 problem types. The slug after it is the stable error code. */
export const PROBLEM_TYPE_BASE = 'https://medmap.example/problems/';

export const REFRESH_COOKIE_NAME = 'medmap_refresh';
/** The refresh cookie is only ever sent to the auth endpoints. */
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

export const JSON_BODY_LIMIT = '100kb';

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

export const EMAIL_VERIFY_TTL_HOURS = 48;
export const PASSWORD_RESET_TTL_MINUTES = 60;
export const INVITE_TTL_DAYS = 7;
export const IDEMPOTENCY_TTL_HOURS = 24;
export const NORMALIZATION_CACHE_TTL_DAYS = 30;

export const MAX_PROFILES_PER_USER = 20;
export const MAX_ACTIVE_MEDICATIONS_PER_PROFILE = 40;
export const MAX_PENDING_INVITES_PER_PROFILE = 20;

/** Fields that must never reach a log line, wherever they appear. */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.passwordHash',
  '*.token',
  '*.tokenHash',
  '*.accessToken',
  '*.email',
  '*.displayName',
  '*.notes',
  '*.rawText',
  '*.strengthText',
];
