import { z } from 'zod';
import { ClientResponseError } from 'pocketbase';
import { pb } from '../pocketbase';
import { NotFoundError, UnauthorizedError } from '../lib/errors';

// Zod schemas
export const roleSchema = z.enum(['Mentor', 'Mentee']);

export const locationSchema = z.object({
  city: z.string(),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  latitude: z.number(),
  longitude: z.number(),
});

export const preferencesSchema = z.object({
  minAge: z.number(),
  maxAge: z.number(),
  maxDistance: z.number(),
});

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  role: roleSchema,
  location: locationSchema,
  preferences: preferencesSchema,
  avatar: z.string().optional(),
  bio: z.string().optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
});

// TypeScript types
export type Role = z.infer<typeof roleSchema>;
export type Location = z.infer<typeof locationSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type User = z.infer<typeof userSchema>;

// PocketBase DTO type (what we get from the database)
type UserDTO = {
  id: string;
  name: string;
  age: number;
  role: Role;
  city: string;
  country: string;
  latitude: string | number; // PocketBase may store as string or number
  longitude: string | number;
  minAge: number;
  maxAge: number;
  maxDistance: number;
  avatar?: string;
  bio?: string;
  skills?: string[];
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
};

/**
 * Transform PocketBase DTO to domain User model
 */
function transformUser(dto: UserDTO): User {
  return userSchema.parse({
    id: dto.id,
    name: dto.name,
    age: dto.age,
    role: dto.role,
    location: {
      city: dto.city,
      country: dto.country,
      latitude: typeof dto.latitude === 'string' ? parseFloat(dto.latitude) : dto.latitude,
      longitude: typeof dto.longitude === 'string' ? parseFloat(dto.longitude) : dto.longitude,
    },
    preferences: {
      minAge: dto.minAge,
      maxAge: dto.maxAge,
      maxDistance: dto.maxDistance ?? 0,
    },
    avatar: dto.avatar,
    bio: dto.bio,
    skills: dto.skills || [],
  });
}

/**
 * Authenticate with PocketBase as admin
 * @throws {UnauthorizedError} if authentication fails
 */
export async function authenticate(): Promise<void> {
  // Check if already authenticated with valid token
  if (pb.authStore.isValid) {
    return; // Already authenticated, skip
  }

  const email = process.env.PB_ADMIN_EMAIL;
  const password = process.env.PB_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new UnauthorizedError(
      'Missing PocketBase admin credentials. Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD environment variables.'
    );
  }

  try {
    // PocketBase v0.23+ uses _superusers collection instead of admins
    await pb.collection('_superusers').authWithPassword(email, password);
  } catch (error) {
    console.error('PocketBase authentication failed:', error);
    if (error instanceof ClientResponseError) {
      throw new UnauthorizedError(`Authentication failed: ${error.message}`);
    }
    throw new UnauthorizedError('Authentication failed');
  }
}

/**
 * Get a single user by ID
 * @throws {NotFoundError} if user doesn't exist
 */
export async function getUserById(id: string): Promise<User> {
  try {
    const result = (await pb
      .collection('user_for_match')
      .getFirstListItem(`id="${id}"`)) as UserDTO;
    return transformUser(result);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new NotFoundError(`User with id "${id}" not found`);
    }
    throw error;
  }
}

/**
 * Get all users by role (Mentor or Mentee)
 */
export async function getUsersByRole(role: Role): Promise<User[]> {
  const filter = `role = "${role}"`;
  const results = (await pb
    .collection('user_for_match')
    .getFullList({ filter })) as UserDTO[];
  return results.map(transformUser);
}

/**
 * Get users by array of IDs
 */
export async function getUsersByIds(ids: string[]): Promise<User[]> {
  if (ids.length === 0) return [];

  const filter = ids.map((id) => `id="${id}"`).join(' || ');
  const results = (await pb
    .collection('user_for_match')
    .getFullList({ filter })) as UserDTO[];
  return results.map(transformUser);
}

/**
 * Get all mentees
 */
export async function getMentees(): Promise<User[]> {
  return getUsersByRole('Mentee');
}

/**
 * Get all mentors
 */
export async function getMentors(): Promise<User[]> {
  return getUsersByRole('Mentor');
}
