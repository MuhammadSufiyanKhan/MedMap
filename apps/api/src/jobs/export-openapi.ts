import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config/env.js';
import { createContainer } from '../container.js';
import { buildOpenApiDocument } from '../utils/openapi.js';
import { createLogger } from '../utils/logger.js';
import { readVersion } from '../utils/version.js';

/**
 * Writes docs/openapi.json from the route table. With `--check` it fails instead when the
 * committed file is out of date; CI uses that to stop the document drifting from the code.
 */
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/openapi.json');

// The route table needs a container, but generating the document touches no database or
// network, so a fixed placeholder configuration is enough.
const config = loadConfig({
  NODE_ENV: 'test',
  MONGODB_URI: 'mongodb://localhost/unused',
  JWT_ACCESS_SECRET: 'openapi-export-placeholder-secret-0000',
});
const { routes } = createContainer(config, createLogger({ level: 'silent', pretty: false }));
const next = `${JSON.stringify(buildOpenApiDocument(routes, readVersion()), null, 2)}\n`;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    // a missing file is reported as out of date below
  }
  if (current !== next) {
    process.stderr.write('docs/openapi.json is out of date. Run: npm run openapi\n');
    process.exit(1);
  }
  process.stdout.write('docs/openapi.json is up to date\n');
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, next);
  process.stdout.write(`wrote ${target}\n`);
}
