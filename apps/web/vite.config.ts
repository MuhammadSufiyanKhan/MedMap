import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiTarget = process.env.VITE_DEV_API_PROXY ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@medmap/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin API in development, exactly like the deployed rewrite.
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
  preview: {
    proxy: { '/api': { target: apiTarget, changeOrigin: false } },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/app/main.tsx'],
      thresholds: {
        'src/domain/**': { lines: 90, functions: 90, statements: 90, branches: 85 },
      },
    },
  },
});
