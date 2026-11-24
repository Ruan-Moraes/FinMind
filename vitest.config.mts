import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    fileParallelism: false,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      include: [
        'src/shared/lib/**/*.ts',
        'src/shared/icons/**/*.ts',
        'src/features/**/domain/**/*.ts',
        'src/features/**/services/**/*.ts',
        'src/features/**/schemas/**/*.ts',
        'src/features/**/parsers/**/*.ts',
        'src/features/**/engine/**/*.ts',
        'src/features/**/models/**/*.ts',
        'src/features/**/providers/**/*.ts',
        'src/features/**/rag/**/*.ts',
        'src/features/**/assistant/**/*.ts',
      ],
      exclude: ['src/shared/lib/prisma.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
