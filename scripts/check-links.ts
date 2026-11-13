import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Checks that every relative link in the repository's Markdown files points at a real file. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'playwright-report']);

function markdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) {
      continue;
    }
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...markdownFiles(path));
    } else if (entry.endsWith('.md') && entry !== 'CHANGELOG.md') {
      files.push(path);
    }
  }
  return files;
}

const broken: string[] = [];
for (const file of markdownFiles('.')) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (target === undefined || /^(https?:|mailto:|#)/.test(target)) {
      continue;
    }
    const path = target.split('#')[0] ?? '';
    if (path === '') {
      continue;
    }
    const resolved = path.startsWith('/') ? resolve('.', `.${path}`) : resolve(dirname(file), path);
    if (!existsSync(resolved)) {
      broken.push(`${file}: ${target}`);
    }
  }
}

if (broken.length > 0) {
  process.stderr.write(`Broken relative links:\n${broken.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('relative links OK\n');
