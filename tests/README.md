# API Integration Tests

## Overview

This project uses an **auto-copy test database** approach for integration tests.

## How It Works

**Before each test run:**
1. Dev database (`/db/pb_data`) is automatically copied to `/api/tests/.tmp/pb_data_test`
2. Dedicated PocketBase instance starts on port 8092 using the copied database
3. Tests run against port 8092 (completely isolated from dev database on 8091)
4. After tests complete, PocketBase is killed and temp database is deleted

**Benefits:**
- ✅ Dev database never touched by tests
- ✅ Schema always in sync (fresh copy from dev each run)
- ✅ Can run dev server and tests simultaneously
- ✅ Minimal overhead (~150ms)

## Running Tests

```bash
cd api
npm test
```

That's it! The auto-copy and PocketBase lifecycle is handled automatically.

## Architecture

```
Development DB:  /db/pb_data          (port 8091)
Test DB:         /api/tests/.tmp/     (port 8092, auto-created)
```

## Performance

- Database size: ~2MB
- Copy time: ~6ms
- PocketBase startup: ~100ms
- Total overhead: ~150ms (negligible)

## Troubleshooting

**Port 8092 already in use:**
```bash
lsof -i :8092
kill -9 <PID>
```

**Tests timeout during setup:**
- Check if PocketBase binary is executable: `chmod +x /db/pocketbase`
- Verify dev database exists: `ls /db/pb_data`
- Check available disk space

**Schema changes not reflected:**
- This should never happen with auto-copy approach
- If it does, verify setup.ts is being run (check console output)

## Test Structure

**Test Helpers:**
- `helpers/database.ts` - Database cleanup and seeding utilities
- `helpers/fixtures.ts` - Test user data with descriptive names

**Integration Tests:**
- `integration/auth-middleware.test.ts` - Authentication middleware tests
- `integration/match-endpoint.test.ts` - Match endpoint tests

**Test Pattern:**
Each test file uses `beforeEach(async () => { await authenticate(); await cleanDatabase(); })` to ensure clean state.

## Development

**Adding New Tests:**
1. Create test file in `/api/tests/integration/`
2. Import test helpers: `import { cleanDatabase, seedUser } from '../helpers/database'`
3. Import fixtures: `import { aliceMentorNYC } from '../helpers/fixtures'`
4. Use `beforeEach` to clean database before each test
5. Use `seedUser()` to create test data
6. Run tests against the API endpoint

**Adding New Fixtures:**
1. Add new fixture to `helpers/fixtures.ts`
2. Use descriptive name (e.g., `bobMenteeChicago`)
3. Include all required user fields
4. Use real coordinates for distance testing
