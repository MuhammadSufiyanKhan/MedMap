import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Layers of the API. Dependencies point one way: routes -> controllers -> services -> repositories -> models. */
const apiElements = [
  { type: 'api-routes', pattern: 'apps/api/src/routes/**', partialMatch: false },
  { type: 'api-controllers', pattern: 'apps/api/src/controllers/**', partialMatch: false },
  { type: 'api-services', pattern: 'apps/api/src/services/**', partialMatch: false },
  { type: 'api-repositories', pattern: 'apps/api/src/repositories/**', partialMatch: false },
  { type: 'api-models', pattern: 'apps/api/src/models/**', partialMatch: false },
  { type: 'api-dto', pattern: 'apps/api/src/dto/**', partialMatch: false },
  { type: 'api-middleware', pattern: 'apps/api/src/middleware/**', partialMatch: false },
  { type: 'api-integrations', pattern: 'apps/api/src/integrations/**', partialMatch: false },
  { type: 'api-engine', pattern: 'apps/api/src/engine/**', partialMatch: false },
  { type: 'api-jobs', pattern: 'apps/api/src/jobs/**', partialMatch: false },
  { type: 'api-utils', pattern: 'apps/api/src/utils/**', partialMatch: false },
  { type: 'api-config', pattern: 'apps/api/src/config/**', partialMatch: false },
  { type: 'api-types', pattern: 'apps/api/src/types/**', partialMatch: false },
  // Composition root: app.ts, server.ts, container.ts. Listed last so layers match first.
  { type: 'api-root', pattern: 'apps/api/src', partialMatch: false },
];

/** Layers of the web app. Imports flow downward only. */
const webElements = [
  { type: 'web-app', pattern: 'apps/web/src/app/**', partialMatch: false },
  { type: 'web-presentation', pattern: 'apps/web/src/presentation/**', partialMatch: false },
  { type: 'web-application', pattern: 'apps/web/src/application/**', partialMatch: false },
  { type: 'web-services', pattern: 'apps/web/src/services/**', partialMatch: false },
  { type: 'web-domain', pattern: 'apps/web/src/domain/**', partialMatch: false },
];

const sharedElements = [{ type: 'shared', pattern: 'packages/shared/src/**', partialMatch: false }];

function policy(from: string[], to: string[]) {
  return {
    from: { element: { types: from } },
    allow: { to: { element: { types: to } } },
  };
}

function allow(from: string, to: string[]) {
  return policy([from], [from, ...to]);
}

const always = ['shared'];
const apiBase = ['api-utils', 'api-config', 'api-types', ...always];

const layerRules = [
  // API
  policy(['api-root', 'api-jobs'], [...apiElements.map((element) => element.type), ...always]),
  allow('api-routes', ['api-controllers', 'api-middleware', ...apiBase]),
  allow('api-controllers', ['api-services', 'api-dto', ...apiBase]),
  allow('api-services', ['api-repositories', 'api-integrations', 'api-engine', ...apiBase]),
  allow('api-repositories', ['api-models', ...apiBase]),
  allow('api-models', ['api-types', ...always]),
  allow('api-dto', apiBase),
  allow('api-middleware', apiBase),
  allow('api-integrations', apiBase),
  allow('api-engine', ['api-types', ...always]),
  allow('api-utils', ['api-config', 'api-types', ...always]),
  allow('api-config', always),
  allow('api-types', always),
  // Web
  policy(['web-app'], [...webElements.map((element) => element.type), ...always]),
  allow('web-presentation', ['web-application', 'web-domain', ...always]),
  allow('web-application', ['web-services', 'web-domain', ...always]),
  allow('web-services', ['web-domain', ...always]),
  allow('web-domain', always),
  allow('shared', []),
];

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/web/playwright-report/**',
      'apps/web/test-results/**',
      '.lighthouseci/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false, arguments: false } },
      ],
    },
  },
  {
    files: ['apps/**/src/**/*.{ts,tsx}', 'packages/shared/src/**/*.ts'],
    plugins: {
      // @ts-expect-error The plugin's CommonJS typings describe a default export that does not exist at runtime under NodeNext.
      boundaries,
    },
    settings: {
      'boundaries/elements': [...apiElements, ...webElements, ...sharedElements],
      'boundaries/include': ['apps/*/src/**/*', 'packages/shared/src/**/*'],
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          noWarnOnMultipleProjects: true,
          project: [
            'apps/api/tsconfig.json',
            'apps/web/tsconfig.json',
            'packages/shared/tsconfig.json',
          ],
        },
      },
    },
    rules: {
      'boundaries/dependencies': ['error', { default: 'disallow', policies: layerRules }],
      'boundaries/no-unknown-files': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // Layer purity that file-to-file rules cannot express.
    files: ['apps/web/src/services/**', 'apps/web/src/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react-*', '@tanstack/*', 'zustand', 'gsap', '@gsap/*'],
              message: 'services/ and domain/ are framework-free.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/presentation/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['gsap', 'gsap/*', '@gsap/*'],
              message: 'Use the animation hooks in application/animation.',
            },
            {
              group: ['@tanstack/react-query'],
              message: 'Data access goes through application/ hooks.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', { name: 'fetch', message: 'Presentation never fetches.' }],
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/repositories/**', 'apps/api/src/models/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: 'mongoose', message: 'Only repositories and models may use Mongoose.' }],
        },
      ],
    },
  },
  {
    files: ['apps/api/src/services/**', 'apps/api/src/engine/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'mongoose', message: 'Only repositories and models may use Mongoose.' },
            { name: 'express', message: 'Services and the engine are HTTP-agnostic.' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/tests/**', '**/e2e/**', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  prettier,
);
