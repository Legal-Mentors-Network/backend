# Matches Endpoint - Setup Documentation

## Overview

The Matches endpoint (`GET /users/:userId/matches`) has been implemented but requires manual database setup to work properly.

## Files Created

1. `/api/src/routes/matches.ts` - Route implementation
2. `/api/tests/integration/matches.test.ts` - Comprehensive test suite

## Database Requirements

The endpoint requires a `matches` collection in PocketBase with the following schema:

### Collection: `matches`

**Fields:**
- `user1` (relation to `users` collection)
  - Type: Relation
  - Required: true
  - Collection: users (_pb_users_auth_)
  - Cascade Delete: true
  - Max Select: 1

- `user2` (relation to `users` collection)
  - Type: Relation
  - Required: true
  - Collection: users (_pb_users_auth_)
  - Cascade Delete: true
  - Max Select: 1

- `matchedAt` (date)
  - Type: Date
  - Required: true

- `conversationStarted` (boolean)
  - Type: Bool
  - Required: false
  - Default: false

**Indexes (Recommended):**
- `CREATE INDEX idx_matches_user1 ON matches (user1)`
- `CREATE INDEX idx_matches_user2 ON matches (user2)`
- `CREATE INDEX idx_matches_matchedAt ON matches (matchedAt)`
- `CREATE UNIQUE INDEX idx_matches_unique ON matches (user1, user2)`

## Manual Setup Steps

### Option 1: Via PocketBase Admin UI (Recommended)

1. Start PocketBase:
   ```bash
   cd db
   ./pocketbase serve --http=127.0.0.1:8090
   ```

2. Open admin UI: http://127.0.0.1:8090/_/

3. Login with:
   - Email: admin@lmn.com
   - Password: admin123456

4. Navigate to Collections > New Collection

5. Create "matches" collection with the fields listed above

6. Add the recommended indexes (optional but improves performance)

### Option 2: Programmatic Creation

A script exists at `/db/create_matches_collection.mjs` but has issues with PocketBase API field creation. Use Admin UI instead.

## Why Manual Setup?

- PocketBase migration syntax has changed between versions
- Automated field creation via API fails silently or returns validation errors
- Admin UI provides better error messages and validation
- One-time setup is acceptable for this stage of development

## Testing

Once the collection is created:

```bash
cd api
npm test -- matches.test.ts
```

All 11 tests should pass.

## Endpoint Specification

**Route:** `GET /users/:userId/matches`

**Response:**
```json
{
  "matches": [
    {
      "matchId": "abc123",
      "profile": {
        "id": "user456",
        "name": "Alice Mentor",
        "age": 30,
        "role": "Mentor",
        "location": { "city": "New York", "country": "US", "latitude": 40.7128, "longitude": -74.006 },
        "preferences": { "minAge": 25, "maxAge": 35, "maxDistance": 50 }
      },
      "matchedAt": "2025-11-10T10:00:00Z",
      "conversationStarted": false
    }
  ],
  "count": 1
}
```

**Features:**
- ✅ Bidirectional query (finds user as user1 or user2)
- ✅ Sorted by matchedAt DESC (most recent first)
- ✅ Returns full profile data for matched users
- ✅ Includes matchId and conversationStarted flag
- ✅ DTO transformation applied (removes PocketBase metadata)
- ✅ Proper error handling (400, 404)

## Integration with Frontend

This endpoint will power the "Your Matches" grid on the Home tab of the frontend app.

## Next Steps

1. Create the `matches` collection via PocketBase Admin UI
2. Run tests to verify: `npm test -- matches.test.ts`
3. Register route in `/api/src/index.ts` (if not already done)
4. Create remaining endpoints: Swipe, Discovery, Conversations

## Troubleshooting

**Error: "Missing or invalid collection context"**
- The `matches` collection doesn't exist
- Follow manual setup steps above

**Error: "no such column: user1"**
- The collection exists but has no fields
- Delete the collection and recreate via Admin UI

**Tests fail with 400 errors**
- Check that all required fields exist in the collection
- Verify field names match exactly: `user1`, `user2`, `matchedAt`, `conversationStarted`

## References

- Full spec: `/zDocs/references/matching-system-refactor.md` (lines 527-570)
- Development patterns: `/api/specs/development.md`
- Testing guidelines: `/api/specs/testing.md`
