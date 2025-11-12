import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'], // Include all test files in tests directory
    testTimeout: 10000, // 10 seconds for integration tests with real database
    hookTimeout: 30000, // 30 seconds for PocketBase startup/shutdown
    globalSetup: './tests/setup.ts', // Auto-copy database and start test PocketBase
  },
});
