import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { pb } from '../pocketbase';
import { userSchema, type User } from '../models/User';
import { BadRequestError, NotFoundError } from '../lib/errors';
import { authMiddleware } from '../middleware/auth';
import { ClientResponseError } from 'pocketbase';

const likes = new Hono();

// Apply auth middleware to all routes
likes.use('*', authMiddleware);

// Request param schema
const idSchema = z.string().min(1);

// Response schema
const incomingLikesResponseSchema = z.object({
  likes: z.array(
    userSchema.extend({
      likedAt: z.string(),
    })
  ),
  count: z.number(),
});

/**
 * PocketBase DTO for user_swipes collection
 */
type SwipeDTO = {
  id: string;
  user: string; // ID of user who swiped
  profile: string; // ID of profile being swiped on
  action: 'like' | 'pass';
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
};

/**
 * PocketBase DTO for user data (same as in User model)
 */
type UserDTO = {
  id: string;
  name: string;
  age: number;
  role: 'Mentor' | 'Mentee';
  city: string;
  country: string;
  latitude: string | number;
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
 * GET /users/:userId/likes/incoming
 * Returns profiles who liked the current user (but user hasn't swiped yet)
 */
likes.get('/users/:userId/likes/incoming', async (ctx: Context) => {
  // Validate user ID param
  const userId = ctx.req.param('userId');
  const validationResult = idSchema.safeParse(userId);
  if (!validationResult.success) {
    throw new BadRequestError('Invalid user ID format.');
  }

  // Verify user exists
  try {
    await pb.collection('user_for_match').getFirstListItem(`id="${userId}"`);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new NotFoundError(`User with id "${userId}" not found`);
    }
    throw error;
  }

  // Step 1: Get all swipes where profile = userId AND action = 'like'
  const incomingLikes = (await pb.collection('user_swipes').getFullList({
    filter: `profile = "${userId}" AND action = "like"`,
    sort: '-created', // Most recent first
  })) as SwipeDTO[];

  const likerIds = incomingLikes.map((swipe) => swipe.user);

  // If no one liked the user, return empty array
  if (likerIds.length === 0) {
    const response = incomingLikesResponseSchema.parse({
      likes: [],
      count: 0,
    });
    return ctx.json(response);
  }

  // Step 2: Get current user's swipes to exclude profiles already swiped on
  const userSwipes = (await pb.collection('user_swipes').getFullList({
    filter: `user = "${userId}"`,
  })) as SwipeDTO[];

  const swipedProfileIds = userSwipes.map((swipe) => swipe.profile);

  // Step 3: Filter out users that current user already swiped on
  const filteredLikerIds = likerIds.filter((id) => !swipedProfileIds.includes(id));

  // If all incoming likes were already swiped on, return empty array
  if (filteredLikerIds.length === 0) {
    const response = incomingLikesResponseSchema.parse({
      likes: [],
      count: 0,
    });
    return ctx.json(response);
  }

  // Step 4: Fetch full profiles for remaining users
  const filter = filteredLikerIds.map((id) => `id="${id}"`).join(' || ');
  const profiles = (await pb.collection('user_for_match').getFullList({ filter })) as UserDTO[];

  // Step 5: Transform profiles and add likedAt timestamp
  const transformedProfiles = profiles.map((profile) => {
    const swipe = incomingLikes.find((s) => s.user === profile.id);
    return {
      ...transformUser(profile),
      likedAt: swipe?.created || new Date().toISOString(),
    };
  });

  // Step 6: Sort by likedAt (most recent first)
  transformedProfiles.sort((a, b) => {
    return new Date(b.likedAt).getTime() - new Date(a.likedAt).getTime();
  });

  // Validate and return response
  const response = incomingLikesResponseSchema.parse({
    likes: transformedProfiles,
    count: transformedProfiles.length,
  });

  return ctx.json(response);
});

export default likes;
