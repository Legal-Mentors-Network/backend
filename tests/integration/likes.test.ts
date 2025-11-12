import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { ZodError } from 'zod';
import { NotFoundError, BadRequestError, ValidationError, UnauthorizedError } from '../../src/lib/errors';
import likesRouter from '../../src/routes/likes';
import { authenticate } from '../../src/models/User';
import { pb } from '../../src/pocketbase';
import { cleanDatabase, seedUser } from '../helpers/database';
import {
  aliceMentorNYC,
  bobMenteeNYC,
  carolMenteeNYC,
  davidMenteeNYCTooYoung,
} from '../helpers/fixtures';

// Create the app with error handling (same as index.ts)
function createApp() {
  const app = new Hono();

  // Global error handler
  app.onError((err, c) => {
    if (err instanceof NotFoundError) {
      return c.json({ error: err.message }, 404);
    }
    if (err instanceof BadRequestError) {
      return c.json({ error: err.message }, 400);
    }
    if (err instanceof ValidationError) {
      return c.json({ error: err.message }, 400);
    }
    if (err instanceof UnauthorizedError) {
      return c.json({ error: err.message }, 401);
    }
    if (err instanceof ZodError) {
      return c.json({ error: 'Validation failed', details: err.issues }, 400);
    }
    console.error('Unexpected error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.route('/', likesRouter);

  return app;
}

describe('GET /users/:userId/likes/incoming', () => {
  beforeEach(async () => {
    // Authenticate with PocketBase before each test
    await authenticate();
    // Clean database before each test
    await cleanDatabase();
  });

  it('returns profiles who liked the user', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);
    const carol = await seedUser(carolMenteeNYC);

    // Bob and Carol like Alice
    await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });
    await pb.collection('user_swipes').create({
      user: carol.id,
      profile: alice.id,
      action: 'like',
    });

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(2);
    expect(data.likes).toHaveLength(2);

    const likerIds = data.likes.map((l: any) => l.id);
    expect(likerIds).toContain(bob.id);
    expect(likerIds).toContain(carol.id);
  });

  it('excludes profiles user already liked back', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);
    const carol = await seedUser(carolMenteeNYC);

    // Bob and Carol like Alice
    await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });
    await pb.collection('user_swipes').create({
      user: carol.id,
      profile: alice.id,
      action: 'like',
    });

    // Alice already swiped on Bob (exclude from results)
    await pb.collection('user_swipes').create({
      user: alice.id,
      profile: bob.id,
      action: 'like',
    });

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.likes).toHaveLength(1);
    expect(data.likes[0].id).toBe(carol.id); // Only Carol
  });

  it('excludes profiles user already passed', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);
    const carol = await seedUser(carolMenteeNYC);

    // Bob and Carol like Alice
    await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });
    await pb.collection('user_swipes').create({
      user: carol.id,
      profile: alice.id,
      action: 'like',
    });

    // Alice already passed on Bob (exclude from results)
    await pb.collection('user_swipes').create({
      user: alice.id,
      profile: bob.id,
      action: 'pass',
    });

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.likes).toHaveLength(1);
    expect(data.likes[0].id).toBe(carol.id); // Only Carol
  });

  it('returns empty array when no incoming likes', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    await seedUser(bobMenteeNYC);
    await seedUser(carolMenteeNYC);

    // No one likes Alice

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
    expect(data.likes).toEqual([]);
  });

  it('includes likedAt timestamp', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);

    // Bob likes Alice
    const swipe = await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.likes).toHaveLength(1);
    expect(data.likes[0].likedAt).toBe(swipe.created);
    expect(data.likes[0].likedAt).toBeTruthy();
    // Verify it's a valid date timestamp
    const parsed = new Date(data.likes[0].likedAt);
    expect(parsed.getTime()).toBeGreaterThan(0); // Valid date
  });

  it('sorted by most recent first', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);
    const carol = await seedUser(carolMenteeNYC);
    const david = await seedUser(davidMenteeNYCTooYoung);

    // Create swipes with delays to ensure different timestamps
    // Bob likes first
    const swipeBob = await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });

    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Carol likes second
    const swipeCarol = await pb.collection('user_swipes').create({
      user: carol.id,
      profile: alice.id,
      action: 'like',
    });

    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100));

    // David likes third (most recent)
    const swipeDavid = await pb.collection('user_swipes').create({
      user: david.id,
      profile: alice.id,
      action: 'like',
    });

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(3);
    expect(data.likes).toHaveLength(3);

    // Verify sorted by most recent first
    expect(data.likes[0].id).toBe(david.id); // Most recent
    expect(data.likes[1].id).toBe(carol.id); // Second
    expect(data.likes[2].id).toBe(bob.id); // Oldest

    // Verify timestamps are in descending order
    const timestamp1 = new Date(data.likes[0].likedAt).getTime();
    const timestamp2 = new Date(data.likes[1].likedAt).getTime();
    const timestamp3 = new Date(data.likes[2].likedAt).getTime();
    expect(timestamp1).toBeGreaterThanOrEqual(timestamp2);
    expect(timestamp2).toBeGreaterThanOrEqual(timestamp3);
  });

  it('only includes like actions not pass', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);
    const carol = await seedUser(carolMenteeNYC);

    // Bob likes Alice
    await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });

    // Carol passes on Alice (should NOT be included)
    await pb.collection('user_swipes').create({
      user: carol.id,
      profile: alice.id,
      action: 'pass',
    });

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.likes).toHaveLength(1);
    expect(data.likes[0].id).toBe(bob.id); // Only Bob (who liked)
  });

  it('returns full profile data with DTO transformation', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);

    // Bob likes Alice
    await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(1);
    expect(data.likes).toHaveLength(1);

    const profile = data.likes[0];
    expect(profile.id).toBe(bob.id);
    expect(profile.name).toBe('Bob Mentee NYC');
    expect(profile.age).toBe(28);
    expect(profile.role).toBe('Mentee');
    expect(profile.location).toEqual({
      city: 'New York',
      country: 'US',
      latitude: 40.7128,
      longitude: -74.006,
    });
    expect(profile.preferences).toEqual({
      minAge: 28,
      maxAge: 40,
      maxDistance: 0,
    });
    expect(profile.likedAt).toBeTruthy();

    // Verify no PocketBase metadata is present
    expect(profile).not.toHaveProperty('collectionId');
    expect(profile).not.toHaveProperty('collectionName');
    expect(profile).not.toHaveProperty('created');
    expect(profile).not.toHaveProperty('updated');
  });

  it('returns 400 when userId is invalid', async () => {
    // Arrange
    const app = createApp();

    // Act - Empty userId
    const req = new Request('http://localhost/users//likes/incoming');
    const res = await app.fetch(req);

    // Assert - Empty ID should return 404 (no route match)
    expect([400, 404]).toContain(res.status);
  });

  it('returns 404 when user does not exist', async () => {
    // Arrange
    const app = createApp();
    const fakeId = 'nonexistentid123';

    // Act
    const req = new Request(`http://localhost/users/${fakeId}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain('not found');
  });

  it('returns empty array when all incoming likes were already swiped on', async () => {
    // Arrange
    const app = createApp();
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);
    const carol = await seedUser(carolMenteeNYC);

    // Bob and Carol like Alice
    await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });
    await pb.collection('user_swipes').create({
      user: carol.id,
      profile: alice.id,
      action: 'like',
    });

    // Alice already swiped on both Bob and Carol
    await pb.collection('user_swipes').create({
      user: alice.id,
      profile: bob.id,
      action: 'like',
    });
    await pb.collection('user_swipes').create({
      user: alice.id,
      profile: carol.id,
      action: 'pass',
    });

    // Act
    const req = new Request(`http://localhost/users/${alice.id}/likes/incoming`);
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.count).toBe(0);
    expect(data.likes).toEqual([]);
  });
});
