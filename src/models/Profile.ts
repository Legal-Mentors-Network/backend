import { z } from 'zod';
import { ClientResponseError } from 'pocketbase';
import { pb } from '../pocketbase.js';
import { ConflictError, BadRequestError } from '../lib/errors.js';

// Zod schemas for profile creation
export const createProfileSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(255),
  age: z.number().int().min(18).max(120),
  role: z.string().transform((val) => {
    const normalized = val.toLowerCase();
    if (normalized === 'mentor') return 'Mentor';
    if (normalized === 'mentee') return 'Mentee';
    throw new Error('Role must be either "mentor" or "mentee"');
  }),
  city: z.string().min(1),
  country: z.string().length(2), // ISO 3166-1 alpha-2
  latitude: z.number().transform((val) => val.toString()),
  longitude: z.number().transform((val) => val.toString()),
  minAge: z.number().int().min(18).max(120),
  maxAge: z.number().int().min(18).max(120),
  maxDistance: z.number().min(0).max(500),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
});

// Add validation refinement for maxAge >= minAge
export const createProfileWithValidationSchema = createProfileSchema.refine(
  (data) => data.maxAge >= data.minAge,
  {
    message: 'maxAge must be greater than or equal to minAge',
    path: ['maxAge'],
  }
);

export type CreateProfileInput = z.input<typeof createProfileSchema>;

// PocketBase profile DTO
type ProfileDTO = {
  id: string;
  user: string;
  name: string;
  age: number;
  role: 'Mentor' | 'Mentee';
  city: string;
  country: string;
  latitude: string;
  longitude: string;
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
 * Create a new profile for a user
 * @throws {ConflictError} if profile already exists for user
 * @throws {BadRequestError} if validation fails
 */
export async function createProfile(input: CreateProfileInput): Promise<ProfileDTO> {
  // Validate input
  const validationResult = createProfileWithValidationSchema.safeParse(input);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new BadRequestError(firstError.message);
  }

  const validatedData = validationResult.data;

  // Check if profile already exists for this user
  try {
    const existingProfiles = await pb
      .collection('profiles')
      .getFullList({ filter: `user = "${validatedData.userId}"` });

    if (existingProfiles.length > 0) {
      throw new ConflictError('Profile already exists for this user');
    }
  } catch (error) {
    // If it's already a ConflictError, re-throw it
    if (error instanceof ConflictError) {
      throw error;
    }
    // If collection doesn't exist (404), that's fine - continue to create
    if (error instanceof ClientResponseError && error.status === 404) {
      // Continue to profile creation
    } else {
      // Other errors should be thrown
      throw error;
    }
  }

  // Create the profile
  try {
    const profileData = {
      user: validatedData.userId,
      name: validatedData.name,
      age: validatedData.age,
      role: validatedData.role,
      location: `${validatedData.city}, ${validatedData.country}`, // Legacy format
      city: validatedData.city,
      country: validatedData.country,
      latitude: validatedData.latitude,
      longitude: validatedData.longitude,
      minAge: validatedData.minAge,
      maxAge: validatedData.maxAge,
      maxDistance: validatedData.maxDistance,
      avatar: validatedData.avatar || 'https://via.placeholder.com/150',
      bio: validatedData.bio,
      skills: validatedData.skills || [],
    };

    const profile = (await pb.collection('profiles').create(profileData)) as ProfileDTO;
    return profile;
  } catch (error) {
    if (error instanceof ClientResponseError) {
      // Handle unique constraint violations
      if (error.status === 400 && error.data?.data?.user) {
        throw new ConflictError('Profile already exists for this user');
      }
      throw new BadRequestError(`Failed to create profile: ${error.message}`);
    }
    throw error;
  }
}
