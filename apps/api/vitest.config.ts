import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@medmap/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/jobs/**', 'src/instrument.ts'],
      thresholds: {
        'src/engine/**': { lines: 90, functions: 90, statements: 90, branches: 90 },
        'src/services/**': { lines: 80, functions: 80, statements: 80, branches: 70 },
      },
    },
  },
});
