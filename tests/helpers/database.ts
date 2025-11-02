import { pb } from '../../src/pocketbase';
import type { User } from '../../src/models/User';

/**
 * Clean all test data from the database
 * Removes all users, profiles, and connections created during tests
 */
export async function cleanDatabase(): Promise<void> {
  try {
    // Delete all connections
    const connections = await pb.collection('connections').getFullList();
    for (const connection of connections) {
      await pb.collection('connections').delete(connection.id);
    }

    // Delete all profiles
    const profiles = await pb.collection('profiles').getFullList();
    for (const profile of profiles) {
      await pb.collection('profiles').delete(profile.id);
    }

    // Delete all user accounts (skip superusers)
    const users = await pb.collection('users').getFullList();
    for (const user of users) {
      await pb.collection('users').delete(user.id);
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
      location: userData.location,
      latitude: userData.latitude.toString(), // PocketBase stores as string
      longitude: userData.longitude.toString(), // PocketBase stores as string
      minAge: userData.minAge,
      maxAge: userData.maxAge,
      maxDistance: userData.maxDistance,
      user: userAccount.id, // Link to the user account
      avatar: 'https://via.placeholder.com/150', // Placeholder avatar URL
    };

    const profile = await pb.collection('profiles').create(profileData);

    // Return using the user's ID (which is what user_for_match view exposes)
    return {
      id: userAccount.id,
      name: profile.name,
      age: profile.age,
      role: profile.role,
      location: profile.location,
      latitude: parseFloat(profile.latitude),
      longitude: parseFloat(profile.longitude),
      minAge: profile.minAge,
      maxAge: profile.maxAge,
      maxDistance: profile.maxDistance,
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
