import { Hono } from 'hono';
import type { Context } from 'hono';
import { createProfile, type CreateProfileInput } from '../models/Profile.js';
import { authMiddleware } from '../middleware/auth.js';

const profiles = new Hono();

// Apply auth middleware to all routes
profiles.use('*', authMiddleware);

/**
 * POST /profiles
 * Create a new profile for a user (multipart form-data, includes avatar file).
 */
profiles.post('/', async (ctx: Context) => {
  const formData = await ctx.req.formData();

  // Build typed input from FormData. Validation runs inside createProfile.
  const skills = formData.getAll('skills').map((v) => String(v)).filter((s) => s.length > 0);
  const input: CreateProfileInput = {
    userId: String(formData.get('userId') ?? ''),
    name: String(formData.get('name') ?? ''),
    age: Number(formData.get('age')),
    role: String(formData.get('role') ?? ''),
    city: String(formData.get('city') ?? ''),
    country: String(formData.get('country') ?? ''),
    latitude: Number(formData.get('latitude')),
    longitude: Number(formData.get('longitude')),
    minAge: Number(formData.get('minAge')),
    maxAge: Number(formData.get('maxAge')),
    maxDistance: Number(formData.get('maxDistance')),
    bio: formData.get('bio') ? String(formData.get('bio')) : undefined,
    skills: skills.length > 0 ? skills : undefined,
  };

  const avatarEntry = formData.get('avatar');
  const avatarFile =
    avatarEntry && typeof avatarEntry === 'object' && 'arrayBuffer' in avatarEntry
      ? (avatarEntry as File)
      : undefined;

  const profile = await createProfile(input, avatarFile);

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
