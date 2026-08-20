// ============================================================
// AI auto - ESLint Configuration (Flat format for ESLint 9)
// ============================================================

import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';

export default [
  // Base JS config
  js.configs.recommended,

  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.turbo/**',
      '*.min.js',
      '.env',
      '.env.local',
    ],
  },

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier,
    },
    rules: {
      ...tseslint.configs['recommended-type-checked'].rules,
      ...tseslint.configs['stylistic-type-checked'].rules,
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // JSON files
  {
    files: ['**/*.json'],
    rules: {
      'prettier/prettier': ['error', { printWidth: 120 }],
    },
  },

  // Markdown files
  {
    files: ['**/*.md'],
    rules: {
      'prettier/prettier': ['error', { proseWrap: 'preserve', printWidth: 80 }],
    },
  },
];
