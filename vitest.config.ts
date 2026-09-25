import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const mobileSrc = fileURLToPath(new URL('./apps/mobile/src', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@': mobileSrc } },
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'apps/mobile/src/**/*.test.ts'],
          exclude: ['**/*.integration.test.ts', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'concurrency',
          include: ['supabase/tests/concurrency/**/*.test.ts'],
          testTimeout: 60_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
      {
        resolve: { alias: { '@': mobileSrc } },
        test: {
          name: 'integration',
          include: ['apps/mobile/src/**/*.integration.test.ts'],
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
