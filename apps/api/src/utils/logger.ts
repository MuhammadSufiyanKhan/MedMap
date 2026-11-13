import { pino } from 'pino';
import type { Logger } from 'pino';
import { LOG_REDACT_PATHS } from '../config/constants.js';

export type { Logger };

/**
 * Creates the structured logger. Health data and credentials are redacted by path, and
 * request bodies are never logged at all.
 */
export function createLogger(options: { level: string; pretty: boolean }): Logger {
  return pino({
    level: options.level,
    redact: { paths: LOG_REDACT_PATHS, censor: '[redacted]' },
    base: { service: 'medmap-api' },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(options.pretty
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}
