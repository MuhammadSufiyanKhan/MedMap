import { readFileSync } from 'node:fs';

/**
 * Fails when `.env.example` and the environment-variable table in README.md disagree.
 * The table sits between the `<!-- env-table:start -->` and `<!-- env-table:end -->` markers.
 */
function namesFromEnvExample(text: string): Set<string> {
  const names = new Set<string>();
  for (const line of text.split('\n')) {
    const match = /^([A-Z][A-Z0-9_]*)=/.exec(line.trim());
    if (match?.[1]) {
      names.add(match[1]);
    }
  }
  return names;
}

function namesFromReadme(text: string): Set<string> {
  const section = /<!-- env-table:start -->([\s\S]*?)<!-- env-table:end -->/.exec(text);
  if (!section?.[1]) {
    throw new Error('README.md is missing the env-table markers');
  }
  const names = new Set<string>();
  for (const line of section[1].split('\n')) {
    const match = /^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/.exec(line);
    if (match?.[1]) {
      names.add(match[1]);
    }
  }
  return names;
}

const env = namesFromEnvExample(readFileSync('.env.example', 'utf8'));
const readme = namesFromReadme(readFileSync('README.md', 'utf8'));
const missingInReadme = [...env].filter((name) => !readme.has(name));
const missingInEnv = [...readme].filter((name) => !env.has(name));

if (missingInReadme.length > 0 || missingInEnv.length > 0) {
  if (missingInReadme.length > 0) {
    process.stderr.write(`In .env.example but not in README: ${missingInReadme.join(', ')}\n`);
  }
  if (missingInEnv.length > 0) {
    process.stderr.write(`In README but not in .env.example: ${missingInEnv.join(', ')}\n`);
  }
  process.exit(1);
}
process.stdout.write(`env table OK (${String(env.size)} variables)\n`);
