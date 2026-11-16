import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/setup/database.ts'],
    // The integration tests share one database and reset it between tests.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
