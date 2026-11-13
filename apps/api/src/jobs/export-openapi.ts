import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_TABLE } from '../routes/index.js';
import { buildOpenApiDocument } from '../utils/openapi.js';
import { readVersion } from '../utils/version.js';

/**
 * Writes docs/openapi.json from the route table. With `--check` it fails instead when the
 * committed file is out of date; CI uses that to stop the document drifting from the code.
 */
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../docs/openapi.json');
const next = `${JSON.stringify(buildOpenApiDocument(ROUTE_TABLE, readVersion()), null, 2)}\n`;

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
