import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { ClientResponseError } from 'pocketbase';
import { pb } from '../pocketbase';
import { authMiddleware } from '../middleware/auth';
import { BadRequestError, NotFoundError } from '../lib/errors';
import { getUserById } from '../models/User';
import type { User } from '../models/User';

const router = new Hono();

// Apply auth middleware to all routes
router.use('*', authMiddleware);

// Validation schemas
const swipeActionSchema = z.enum(['like', 'pass']);

const swipeRequestSchema = z.object({
  profileId: z.string().min(1, 'profileId is required'),
  action: swipeActionSchema,
});

// Types for response
type SwipeRecord = {
  id: string;
  user: string;
  profile: string;
  action: 'like' | 'pass';
  created: string;
};

type MatchRecord = {
  id: string;
  user1: string;
  user2: string;
  matchedAt: string;
  conversationStarted: boolean;
  profile: User;
};

type SwipeResponse = {
  swipe: SwipeRecord;
  match: MatchRecord | null;
  message: string;
};

/**
 * Check for mutual match and create match record if both users liked each other
 */
async function checkMutualMatch(
  userId: string,
  profileId: string
): Promise<MatchRecord | null> {
  try {
    // Check if the other user has already liked us
    const theirSwipe = await pb
      .collection('user_swipes')
      .getFirstListItem(`user = "${profileId}" AND profile = "${userId}" AND action = "like"`);

    if (!theirSwipe) {
      return null; // They haven't liked us back
    }

    // Create match record with user1 < user2 ordering for uniqueness
    const [user1, user2] = [userId, profileId].sort();

    const match = await pb.collection('matches').create({
      user1,
      user2,
      matchedAt: new Date().toISOString(),
      conversationStarted: false,
    });

    // Fetch full profile of the matched user
    const profile = await getUserById(profileId);

    return {
      id: match.id,
      user1: match.user1,
      user2: match.user2,
      matchedAt: match.matchedAt,
      conversationStarted: match.conversationStarted,
      profile,
    };
  } catch (error) {
    // If getFirstListItem throws 404, it means they haven't liked us
    if (error instanceof ClientResponseError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * POST /users/:userId/swipes
 * Record a swipe action (like or pass) and check for mutual match
 */
router.post('/:userId/swipes', async (ctx: Context) => {
  const userId = ctx.req.param('userId');

  // Validate request body
  const body = await ctx.req.json();
  const validationResult = swipeRequestSchema.safeParse(body);

  if (!validationResult.success) {
    throw new BadRequestError('Invalid request body');
  }

  const { profileId, action } = validationResult.data;

  // Verify both users exist
  try {
    await getUserById(userId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError(`User with id "${userId}" not found`);
    }
    throw error;
  }

  try {
    await getUserById(profileId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError(`Profile with id "${profileId}" not found`);
    }
    throw error;
  }

  // Create swipe record
  let swipe;
  try {
    swipe = await pb.collection('user_swipes').create({
      user: userId,
      profile: profileId,
      action,
    });
  } catch (error) {
    // Handle duplicate swipe (UNIQUE constraint violation)
    if (error instanceof ClientResponseError && error.status === 400) {
      // PocketBase returns 400 for constraint violations
      const errorData = error.data?.data;
      if (errorData && (errorData.user || errorData.profile)) {
        return ctx.json({ error: 'Already swiped this profile' }, 409);
      }
    }
    throw error;
  }

  // Check for mutual match only if action is 'like'
  let match: MatchRecord | null = null;
  if (action === 'like') {
    match = await checkMutualMatch(userId, profileId);
  }

  const response: SwipeResponse = {
    swipe: {
      id: swipe.id,
      user: swipe.user,
      profile: swipe.profile,
      action: swipe.action,
      created: swipe.created,
    },
    match,
    message: match ? "It's a match!" : 'Swipe recorded',
  };

  return ctx.json(response);
});

export default router;
