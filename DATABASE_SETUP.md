# Database Setup for Swipe Endpoint

## Required Collections

Before running the swipe endpoint tests, you need to create the following collections in PocketBase:

### 1. `user_swipes` Collection

**Purpose**: Records swipe actions (like/pass) from users

**Fields:**
- `user` (Relation) - Single relation to `users` collection - The user who performed the swipe
- `profile` (Relation) - Single relation to `users` collection - The profile being swiped on
- `action` (Select) - Single select - Options: `like`, `pass`
- `created` (Date) - Auto-generated timestamp
- `updated` (Date) - Auto-generated timestamp

**Indexes:**
- UNIQUE constraint on (`user`, `profile`) to prevent duplicate swipes

**API Rules:**
- List/View: `@request.auth.id != ""`
- Create: `@request.auth.id != ""`
- Update: Disabled
- Delete: `@request.auth.id = user.id`

**Schema (JSON):**
```json
{
  "name": "user_swipes",
  "type": "base",
  "schema": [
    {
      "name": "user",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "users",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["email"]
      }
    },
    {
      "name": "profile",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "users",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["email"]
      }
    },
    {
      "name": "action",
      "type": "select",
      "required": true,
      "options": {
        "maxSelect": 1,
        "values": ["like", "pass"]
      }
    }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX idx_user_swipes_unique ON user_swipes (user, profile)"
  ]
}
```

### 2. `matches` Collection

**Purpose**: Stores mutual matches between users

**Fields:**
- `user1` (Relation) - Single relation to `users` collection - First user (alphabetically sorted)
- `user2` (Relation) - Single relation to `users` collection - Second user (alphabetically sorted)
- `matchedAt` (Date) - Timestamp when match was created
- `conversationStarted` (Bool) - Whether users have started messaging
- `created` (Date) - Auto-generated timestamp
- `updated` (Date) - Auto-generated timestamp

**Indexes:**
- UNIQUE constraint on (`user1`, `user2`) to prevent duplicate matches

**API Rules:**
- List/View: `@request.auth.id = user1.id || @request.auth.id = user2.id`
- Create: `@request.auth.id != ""`
- Update: `@request.auth.id = user1.id || @request.auth.id = user2.id`
- Delete: Disabled

**Schema (JSON):**
```json
{
  "name": "matches",
  "type": "base",
  "schema": [
    {
      "name": "user1",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "users",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["email"]
      }
    },
    {
      "name": "user2",
      "type": "relation",
      "required": true,
      "options": {
        "collectionId": "users",
        "cascadeDelete": false,
        "minSelect": null,
        "maxSelect": 1,
        "displayFields": ["email"]
      }
    },
    {
      "name": "matchedAt",
      "type": "date",
      "required": true
    },
    {
      "name": "conversationStarted",
      "type": "bool",
      "required": true,
      "options": {
        "default": false
      }
    }
  ],
  "indexes": [
    "CREATE UNIQUE INDEX idx_matches_unique ON matches (user1, user2)"
  ]
}
```

## Setup Instructions

### Option 1: Via PocketBase Admin UI (Recommended for Development)

1. Start PocketBase:
   ```bash
   cd db
   ./pocketbase serve --http=127.0.0.1:8090
   ```

2. Open Admin UI: http://127.0.0.1:8090/_/

3. Login with:
   - Email: `admin@lmn.com`
   - Password: `admin123456`

4. Navigate to **Collections** → **New Collection**

5. For each collection (`user_swipes` and `matches`):
   - Click "New Collection"
   - Select "Base Collection"
   - Add fields as specified above
   - Set up API rules as specified
   - Add indexes using the SQL provided

### Option 2: Via PocketBase Migrations (Recommended for Production)

Create migration files in `/db/pb_migrations/`:

**File: `1699999999_create_swipe_collections.js`**
```javascript
migrate((db) => {
  // Create user_swipes collection
  const userSwipesCollection = new Collection({
    name: "user_swipes",
    type: "base",
    schema: [
      {
        name: "user",
        type: "relation",
        required: true,
        options: {
          collectionId: "users",
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["email"]
        }
      },
      {
        name: "profile",
        type: "relation",
        required: true,
        options: {
          collectionId: "users",
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["email"]
        }
      },
      {
        name: "action",
        type: "select",
        required: true,
        options: {
          maxSelect: 1,
          values: ["like", "pass"]
        }
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_user_swipes_unique ON user_swipes (user, profile)"
    ]
  });

  // Create matches collection
  const matchesCollection = new Collection({
    name: "matches",
    type: "base",
    schema: [
      {
        name: "user1",
        type: "relation",
        required: true,
        options: {
          collectionId: "users",
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["email"]
        }
      },
      {
        name: "user2",
        type: "relation",
        required: true,
        options: {
          collectionId: "users",
          cascadeDelete: false,
          minSelect: null,
          maxSelect: 1,
          displayFields: ["email"]
        }
      },
      {
        name: "matchedAt",
        type: "date",
        required: true
      },
      {
        name: "conversationStarted",
        type: "bool",
        required: true,
        options: {
          default: false
        }
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_matches_unique ON matches (user1, user2)"
    ]
  });

  return Dao(db).saveCollection(userSwipesCollection) &&
         Dao(db).saveCollection(matchesCollection);
}, (db) => {
  // Rollback
  const dao = new Dao(db);
  dao.deleteCollection("user_swipes");
  dao.deleteCollection("matches");
});
```

Then run:
```bash
cd db
./pocketbase migrate up
```

## Verification

After creating the collections, verify they exist:

```bash
# Via PocketBase API
curl http://127.0.0.1:8090/api/collections
```

You should see `user_swipes` and `matches` in the response.

## Testing

Once collections are created, run the swipe endpoint tests:

```bash
cd api
npm test -- tests/integration/swipes.test.ts
```

All 17 tests should pass.
