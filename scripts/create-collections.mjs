/**
 * Script to create user_swipes and matches collections in PocketBase
 * Run with: node scripts/create-collections.mjs
 */

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@lmn.com';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456';

async function authenticate() {
  const response = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identity: PB_ADMIN_EMAIL,
      password: PB_ADMIN_PASSWORD
    })
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.token;
}

async function createCollection(token, collectionData) {
  const response = await fetch(`${PB_URL}/api/collections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify(collectionData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create collection: ${error}`);
  }

  return await response.json();
}

async function collectionExists(token, name) {
  const response = await fetch(`${PB_URL}/api/collections`, {
    headers: { 'Authorization': token }
  });

  if (!response.ok) {
    return false;
  }

  const collections = await response.json();
  return collections.some(c => c.name === name);
}

async function deleteCollection(token, name) {
  // First get the collection ID
  const response = await fetch(`${PB_URL}/api/collections`, {
    headers: { 'Authorization': token }
  });

  if (!response.ok) {
    return false;
  }

  const collections = await response.json();
  const collection = collections.find(c => c.name === name);

  if (!collection) {
    return false;
  }

  // Delete it
  const deleteResponse = await fetch(`${PB_URL}/api/collections/${collection.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': token }
  });

  return deleteResponse.ok;
}

async function main() {
  try {
    console.log('🔐 Authenticating...');
    const token = await authenticate();
    console.log('✅ Authenticated successfully\n');

    // Delete old connections collection if it exists
    console.log('🗑️  Checking for old connections collection...');
    if (await collectionExists(token, 'connections')) {
      console.log('   Found connections collection, deleting...');
      await deleteCollection(token, 'connections');
      console.log('✅ Deleted old connections collection\n');
    } else {
      console.log('   No connections collection found\n');
    }

    // Create user_swipes collection
    console.log('📝 Creating user_swipes collection...');
    if (await collectionExists(token, 'user_swipes')) {
      console.log('⚠️  user_swipes collection already exists\n');
    } else {
      const userSwipesSchema = {
        name: 'user_swipes',
        type: 'base',
        schema: [
          {
            name: 'user',
            type: 'relation',
            required: true,
            options: {
              collectionId: 'users',
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'profile',
            type: 'relation',
            required: true,
            options: {
              collectionId: 'users',
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'action',
            type: 'select',
            required: true,
            options: {
              maxSelect: 1,
              values: ['like', 'pass']
            }
          }
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_user_swipes_unique ON user_swipes (user, profile)'
        ]
      };

      await createCollection(token, userSwipesSchema);
      console.log('✅ Created user_swipes collection\n');
    }

    // Create matches collection
    console.log('📝 Creating matches collection...');
    if (await collectionExists(token, 'matches')) {
      console.log('⚠️  matches collection already exists\n');
    } else {
      const matchesSchema = {
        name: 'matches',
        type: 'base',
        schema: [
          {
            name: 'user1',
            type: 'relation',
            required: true,
            options: {
              collectionId: 'users',
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'user2',
            type: 'relation',
            required: true,
            options: {
              collectionId: 'users',
              cascadeDelete: false,
              minSelect: null,
              maxSelect: 1,
              displayFields: ['email']
            }
          },
          {
            name: 'matchedAt',
            type: 'date',
            required: true
          },
          {
            name: 'conversationStarted',
            type: 'bool',
            required: true
          }
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_matches_unique ON matches (user1, user2)'
        ]
      };

      await createCollection(token, matchesSchema);
      console.log('✅ Created matches collection\n');
    }

    console.log('🎉 Database setup complete!');
    console.log('\nNext steps:');
    console.log('  cd api');
    console.log('  npm test');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
