import { ClientResponseError } from 'pocketbase';
import { pb } from '../../src/pocketbase';
import type { User } from '../../src/models/User';

/**
 * Clean all test data from the database
 * Removes all users, profiles, connections, and swipes created during tests
 */
export async function cleanDatabase(): Promise<void> {
  try {
    // Helper function to safely delete all records from a collection
    async function cleanCollection(collectionName: string): Promise<void> {
      try {
        const records = await pb.collection(collectionName).getFullList();
        for (const record of records) {
          try {
            await pb.collection(collectionName).delete(record.id);
          } catch (error) {
            // Ignore 404 errors for records that may have been cascade-deleted
            if (error instanceof ClientResponseError && error.status === 404) {
              continue;
            }
            throw error;
          }
        }
      } catch (error) {
        // Ignore 404 errors for missing collections (they might not exist yet)
        if (error instanceof ClientResponseError && error.status === 404) {
          return;
        }
        throw error;
      }
    }

    // Delete all swipe-related data
    await cleanCollection('user_swipes');
    await cleanCollection('matches');

    // Delete all profiles
    await cleanCollection('profiles');

    // Delete all non-admin user accounts
    const users = await pb.collection('users').getFullList();
    for (const user of users) {
      // Skip the admin user (check by email)
      if (user.email && user.email.includes('admin@')) {
        continue;
      }
      try {
        await pb.collection('users').delete(user.id);
      } catch (error) {
        // Ignore 404 errors for users that may have been cascade-deleted
        if (error instanceof ClientResponseError && error.status === 404) {
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Error cleaning database:', error);
    throw error;
  }
}

/**
 * Seed a user into the database for testing
 * Creates both a user account and profile record which then appears in user_for_match view
 */
export async function seedUser(userData: Omit<User, 'id'>): Promise<User> {
  try {
    // First, create a user account
    const userAccount = await pb.collection('users').create({
      email: `test-${Date.now()}-${Math.random()}@example.com`, // Unique email
      password: 'test123456',
      passwordConfirm: 'test123456',
      onboarding: false, // Must be false to appear in user_for_match view
    });

    // Then create the profile linked to the user
    const profileData = {
      name: userData.name,
      age: userData.age,
      role: userData.role,
      location: `${userData.location.city}, ${userData.location.country}`, // Keep for backward compatibility
      city: userData.location.city,
      country: userData.location.country,
      latitude: userData.location.latitude.toString(), // PocketBase stores as string
      longitude: userData.location.longitude.toString(), // PocketBase stores as string
      minAge: userData.preferences.minAge,
      maxAge: userData.preferences.maxAge,
      maxDistance: userData.preferences.maxDistance,
      user: userAccount.id, // Link to the user account
      avatar: userData.avatar || 'https://via.placeholder.com/150', // Placeholder avatar URL
      bio: userData.bio,
      skills: userData.skills || [],
    };

    const profile = await pb.collection('profiles').create(profileData);

    // Return using the user's ID (which is what user_for_match view exposes)
    return {
      id: userAccount.id,
      name: profile.name,
      age: profile.age,
      role: profile.role,
      location: {
        city: profile.city,
        country: profile.country,
        latitude: parseFloat(profile.latitude),
        longitude: parseFloat(profile.longitude),
      },
      preferences: {
        minAge: profile.minAge,
        maxAge: profile.maxAge,
        maxDistance: profile.maxDistance,
      },
      avatar: profile.avatar,
      bio: profile.bio,
      skills: profile.skills || [],
    };
  } catch (error) {
    console.error('Error seeding user:', error);
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('PocketBase error response:', JSON.stringify((error as any).response, null, 2));
    }
    throw error;
  }
}

/**
 * Seed multiple users into the database
 */
export async function seedUsers(usersData: Omit<User, 'id'>[]): Promise<User[]> {
  const seededUsers: User[] = [];
  for (const userData of usersData) {
    const user = await seedUser(userData);
    seededUsers.push(user);
  }
  return seededUsers;
}
