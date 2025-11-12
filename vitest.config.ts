import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'], // Include all test files in tests directory
    testTimeout: 10000, // 10 seconds for integration tests with real database
    hookTimeout: 30000, // 30 seconds for PocketBase startup/shutdown
    globalSetup: './tests/setup.ts', // Auto-copy database and start test PocketBase
    pool: 'forks', // Use forked processes instead of threads
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in a single fork (sequentially)
      },
    },
    fileParallelism: false, // Run test files sequentially, not in parallel
    maxConcurrency: 1, // Run only 1 test at a time
  },
});
