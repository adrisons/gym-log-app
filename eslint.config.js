// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';
import { elements, dependencyPolicies } from './eslint.boundaries.js';

// Ban literal colours (hex / rgb() / hsl()) in source outside the design
// module. Best-effort — the binding check is scripts/check-no-color-literals.sh
// (wired into CI). See spec FR-022 / SC-007.
const COLOUR_LITERAL_SELECTOR =
  'Literal[value=/#(?:[0-9a-fA-F]{3,4}){1,2}\\b|\\b(?:rgb|rgba|hsl|hsla)\\(/]';

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'dev-dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'node_modules/',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React, only for the presentation layer.
  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    ...react.configs.flat.recommended,
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
    },
  },

  // Architectural boundaries — the whole src/ graph.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      // boundaries resolves import paths via eslint-module-utils/resolve,
      // which reads this. Needed so `../application/ports/storage-port`
      // (extensionless TS) and the `@/*` alias resolve to real files and
      // can be classified.
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
      },
      'boundaries/elements': elements,
      'boundaries/include': ['src/**/*'],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: dependencyPolicies(),
        },
      ],
    },
  },

  // No literal colours outside the design module.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/presentation/design/**'],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: COLOUR_LITERAL_SELECTOR,
          message:
            'Literal colour value — use a design token from src/presentation/design instead.',
        },
      ],
    },
  },

  // Tests may import anything (fakes, internals) — boundaries do not apply.
  {
    files: ['test/**/*.{ts,tsx}', '*.config.{ts,js}', 'eslint.boundaries.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettier,
);
