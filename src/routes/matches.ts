import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { getUsersByIds, userSchema } from '../models/User';
import { BadRequestError, NotFoundError } from '../lib/errors';
import { authMiddleware } from '../middleware/auth';
import { pb } from '../pocketbase';
import { ClientResponseError } from 'pocketbase';

const matches = new Hono();

// Apply auth middleware to all routes
matches.use('*', authMiddleware);

// Request param schema
const idSchema = z.string().min(1);

// Match item schema
const matchItemSchema = z.object({
  matchId: z.string(),
  profile: userSchema,
  matchedAt: z.string(),
  conversationStarted: z.boolean(),
});

// Response schema
const matchesResponseSchema = z.object({
  matches: z.array(matchItemSchema),
  count: z.number(),
});

/**
 * GET /users/:userId/matches
 * Fetch all mutual matches for a user
 *
 * Query logic: Find all matches where user is either user1 or user2,
 * then fetch full profiles for the matched users.
 */
matches.get('/users/:userId/matches', async (ctx: Context) => {
  // Validate userId param
  const userId = ctx.req.param('userId');
  const validationResult = idSchema.safeParse(userId);
  if (!validationResult.success) {
    throw new BadRequestError('Invalid user ID format.');
  }

  try {
    // Step 1: Query matches where user is either user1 or user2
    const matchRecords = await pb.collection('matches').getFullList({
      filter: `user1 = "${userId}" || user2 = "${userId}"`,
      sort: '-matchedAt', // Most recent first
    });

    // Step 2: Determine matched user ID for each match
    const matchData = matchRecords.map((match) => ({
      matchId: match.id,
      matchedUserId: match.user1 === userId ? match.user2 : match.user1,
      matchedAt: match.matchedAt,
      conversationStarted: match.conversationStarted ?? false,
    }));

    // Step 3: Early return if no matches
    if (matchData.length === 0) {
      const response = matchesResponseSchema.parse({
        matches: [],
        count: 0,
      });
      return ctx.json(response);
    }

    // Step 4: Fetch full profiles for all matched users
    const matchedUserIds = matchData.map((m) => m.matchedUserId);
    const profiles = await getUsersByIds(matchedUserIds);

    // Create a map for quick lookup
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    // Step 5: Combine match data with profiles
    const enrichedMatches = matchData
      .map((m) => {
        const profile = profileMap.get(m.matchedUserId);
        if (!profile) {
          // Skip matches where profile couldn't be found (deleted user)
          return null;
        }
        return {
          matchId: m.matchId,
          profile,
          matchedAt: m.matchedAt,
          conversationStarted: m.conversationStarted,
        };
      })
      .filter((m) => m !== null);

    // Validate and return response
    const response = matchesResponseSchema.parse({
      matches: enrichedMatches,
      count: enrichedMatches.length,
    });

    return ctx.json(response);
  } catch (error) {
    // Handle PocketBase errors
    if (error instanceof ClientResponseError) {
      if (error.status === 404) {
        throw new NotFoundError(`User with id "${userId}" not found`);
      }
      throw error;
    }
    throw error;
  }
});

export default matches;
