import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { createProfile, createProfileSchema } from '../models/Profile.js';
import { authMiddleware } from '../middleware/auth.js';

const profiles = new Hono();

// Apply auth middleware to all routes
profiles.use('*', authMiddleware);

// Request body schema (input types match frontend)
const createProfileRequestSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1).max(255),
  age: z.number().int().min(18).max(120),
  role: z.string(),
  city: z.string().min(1),
  country: z.string().length(2),
  latitude: z.number(),
  longitude: z.number(),
  minAge: z.number().int().min(18).max(120),
  maxAge: z.number().int().min(18).max(120),
  maxDistance: z.number().min(0).max(500),
  avatar: z.string().optional(),
  bio: z.string().optional(),
  skills: z.array(z.string().min(1).max(50)).max(20).optional(),
});

/**
 * POST /profiles
 * Create a new profile for a user
 */
profiles.post('/', async (ctx: Context) => {
  const body = await ctx.req.json();

  // Validate request body
  const validation = createProfileRequestSchema.safeParse(body);
  if (!validation.success) {
    return ctx.json(
      {
        error: 'Validation failed',
        details: validation.error.issues,
      },
      400
    );
  }

  // Create profile
  const profile = await createProfile(validation.data);

  // Return created profile
  return ctx.json(
    {
      id: profile.id,
      userId: profile.user,
      name: profile.name,
      age: profile.age,
      role: profile.role,
      city: profile.city,
      country: profile.country,
      latitude: profile.latitude,
      longitude: profile.longitude,
      minAge: profile.minAge,
      maxAge: profile.maxAge,
      maxDistance: profile.maxDistance,
      avatar: profile.avatar,
      bio: profile.bio,
      skills: profile.skills || [],
      created: profile.created,
      updated: profile.updated,
    },
    201
  );
});

export default profiles;
