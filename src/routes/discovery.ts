import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { ClientResponseError } from 'pocketbase';
import { getUserById, getMentees, getMentors, userSchema } from '../models/User';
import { findMatches } from '../models/match';
import { BadRequestError } from '../lib/errors';
import { authMiddleware } from '../middleware/auth';
import { pb } from '../pocketbase';

const discovery = new Hono();

// Apply auth middleware to all routes
discovery.use('*', authMiddleware);

// Request param schema
const idSchema = z.string().min(1);

// Query params schema
const queryParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).optional().default(20).transform((val) => Math.min(val, 50)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// Response schema
const discoveryResponseSchema = z.object({
  profiles: z.array(userSchema),
  hasMore: z.boolean(),
  nextOffset: z.number(),
  total: z.number(),
});

/**
 * GET /users/:userId/discovery?limit=20&offset=0
 * Returns paginated potential matches excluding already-swiped profiles
 */
discovery.get('/:userId/discovery', async (ctx: Context) => {
  // Validate user ID param
  const userId = ctx.req.param('userId');
  const idValidation = idSchema.safeParse(userId);
  if (!idValidation.success) {
    throw new BadRequestError('Invalid user ID format.');
  }

  // Validate query params
  const queryParams = ctx.req.query();
  const queryValidation = queryParamsSchema.safeParse(queryParams);
  if (!queryValidation.success) {
    throw new BadRequestError('Invalid query parameters.');
  }

  const { limit, offset } = queryValidation.data;

  // Get current user profile
  const currentUser = await getUserById(userId);

  // Get potential matches based on opposite role
  let potentialMatches = [];
  switch (currentUser.role) {
    case 'Mentee':
      potentialMatches = await getMentors();
      break;
    case 'Mentor':
      potentialMatches = await getMentees();
      break;
  }

  // Apply matching algorithm (age, location, preferences)
  const algorithmMatches = findMatches(currentUser, potentialMatches);

  // Get already-swiped profile IDs for this user
  let swipedProfileIds: string[] = [];
  try {
    swipedProfileIds = await pb
      .collection('user_swipes')
      .getFullList({ filter: `user = "${userId}"` })
      .then((records) => records.map((r) => r.profile));
  } catch (error) {
    // If user_swipes collection doesn't exist yet, treat as no swipes
    if (error instanceof ClientResponseError && error.status === 404) {
      swipedProfileIds = [];
    } else {
      throw error;
    }
  }

  // Filter out already-swiped profiles
  const availableMatches = algorithmMatches.filter(
    (user) => !swipedProfileIds.includes(user.id)
  );

  // Apply pagination
  const total = availableMatches.length;
  const paginatedMatches = availableMatches.slice(offset, offset + limit);
  const hasMore = offset + limit < total;
  const nextOffset = hasMore ? offset + limit : offset;

  // Validate and return response
  const response = discoveryResponseSchema.parse({
    profiles: paginatedMatches,
    hasMore,
    nextOffset,
    total,
  });

  return ctx.json(response);
});

export default discovery;
