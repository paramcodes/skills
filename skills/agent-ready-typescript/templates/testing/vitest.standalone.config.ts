// Use only when the project does not already have a Vite config.
// In a Vite app, merge the `test` section into vite.config.ts instead.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/**/*.{test,spec}.{ts,tsx}',
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});
