// Adapt file globs and TSConfig coverage to your repository before adopting.
// Install eslint-config-prettier as well as ESLint and typescript-eslint.
// API follows the current typescript-eslint flat-config guidance.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

export default defineConfig(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.next/**',
      '**/generated/**',
      '**/*.config.{js,mjs,cjs,ts,mts,cts}',
      'eslint.config.mjs',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      complexity: ['warn', 12],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],
    },
  },
  // Keep Prettier as the formatting source of truth; place after other rule presets.
  eslintConfigPrettier,
);
