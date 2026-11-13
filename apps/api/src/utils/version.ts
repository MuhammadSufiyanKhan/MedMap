import { readFileSync } from 'node:fs';

/** Reads the API version from package.json once at startup. */
export function readVersion(): string {
  try {
    const raw: unknown = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    );
    if (
      typeof raw === 'object' &&
      raw !== null &&
      'version' in raw &&
      typeof raw.version === 'string'
    ) {
      return raw.version;
    }
  } catch {
    // fall through
  }
  return '0.0.0';
}
