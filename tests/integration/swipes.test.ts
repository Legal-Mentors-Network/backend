import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { ZodError } from 'zod';
import { NotFoundError, BadRequestError, ValidationError, UnauthorizedError } from '../../src/lib/errors';
import swipesRouter from '../../src/routes/swipes';
import { authenticate } from '../../src/models/User';
import { pb } from '../../src/pocketbase';
import { cleanDatabase, seedUser } from '../helpers/database';
import { aliceMentorNYC, bobMenteeNYC, carolMenteeNYC } from '../helpers/fixtures';

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

  app.route('/users', swipesRouter);

  return app;
}

describe('POST /users/:userId/swipes', () => {
  beforeEach(async () => {
    await authenticate();
    await cleanDatabase();
  });

  describe('Happy Path - Like Actions', () => {
    it('records like action successfully', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.swipe).toBeDefined();
      expect(data.swipe.user).toBe(alice.id);
      expect(data.swipe.profile).toBe(bob.id);
      expect(data.swipe.action).toBe('like');
      expect(data.swipe.id).toBeDefined();
      expect(data.swipe.created).toBeDefined();

      expect(data.match).toBeNull(); // No match yet (Bob hasn't liked back)
      expect(data.message).toBe('Swipe recorded');

      // Verify swipe was saved to database
      const swipes = await pb.collection('user_swipes').getFullList();
      expect(swipes).toHaveLength(1);
      expect(swipes[0].user).toBe(alice.id);
      expect(swipes[0].profile).toBe(bob.id);
      expect(swipes[0].action).toBe('like');
    });

    it('detects mutual match when both users like each other', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Bob likes Alice first
      await pb.collection('user_swipes').create({
        user: bob.id,
        profile: alice.id,
        action: 'like',
      });

      // Alice likes Bob back (should create match)
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.match).toBeDefined();
      expect(data.match.id).toBeDefined();
      expect(data.match.user1).toBe(alice.id < bob.id ? alice.id : bob.id);
      expect(data.match.user2).toBe(alice.id < bob.id ? bob.id : alice.id);
      expect(data.match.matchedAt).toBeDefined();
      expect(data.match.conversationStarted).toBe(false);
      expect(data.message).toBe("It's a match!");

      // Verify match was saved to database
      const matches = await pb.collection('matches').getFullList();
      expect(matches).toHaveLength(1);
    });

    it('creates match record with user1 < user2 ordering', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Bob likes Alice
      await pb.collection('user_swipes').create({
        user: bob.id,
        profile: alice.id,
        action: 'like',
      });

      // Alice likes Bob back
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      // Ensure user1 < user2 (alphabetically)
      expect(data.match.user1 < data.match.user2).toBe(true);
    });

    it('returns full profile in match object', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Bob likes Alice
      await pb.collection('user_swipes').create({
        user: bob.id,
        profile: alice.id,
        action: 'like',
      });

      // Alice likes Bob back
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.match.profile).toBeDefined();
      expect(data.match.profile.id).toBe(bob.id);
      expect(data.match.profile.name).toBe('Bob Mentee NYC');
      expect(data.match.profile.age).toBe(28);
      expect(data.match.profile.role).toBe('Mentee');
      expect(data.match.profile.location).toBeDefined();
      expect(data.match.profile.preferences).toBeDefined();
    });

    it('sets conversationStarted=false on new match', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Bob likes Alice
      await pb.collection('user_swipes').create({
        user: bob.id,
        profile: alice.id,
        action: 'like',
      });

      // Alice likes Bob back
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.match.conversationStarted).toBe(false);
    });
  });

  describe('Happy Path - Pass Actions', () => {
    it('records pass action successfully', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'pass' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.swipe).toBeDefined();
      expect(data.swipe.action).toBe('pass');
      expect(data.match).toBeNull();
      expect(data.message).toBe('Swipe recorded');

      // Verify swipe was saved to database
      const swipes = await pb.collection('user_swipes').getFullList();
      expect(swipes).toHaveLength(1);
      expect(swipes[0].action).toBe('pass');
    });

    it('does NOT create match on pass action', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Bob likes Alice
      await pb.collection('user_swipes').create({
        user: bob.id,
        profile: alice.id,
        action: 'like',
      });

      // Alice passes on Bob
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'pass' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.match).toBeNull();
      expect(data.message).toBe('Swipe recorded');

      // Verify NO match was created
      const matches = await pb.collection('matches').getFullList();
      expect(matches).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('does NOT create match when only one user liked', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Alice likes Bob (but Bob hasn't liked Alice yet)
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.match).toBeNull();
      expect(data.message).toBe('Swipe recorded');

      // Verify NO match was created
      const matches = await pb.collection('matches').getFullList();
      expect(matches).toHaveLength(0);
    });

    it('does NOT create match if other user passed', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Bob passed on Alice
      await pb.collection('user_swipes').create({
        user: bob.id,
        profile: alice.id,
        action: 'pass',
      });

      // Alice likes Bob
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.match).toBeNull(); // No match because Bob passed
      expect(data.message).toBe('Swipe recorded');

      // Verify NO match was created
      const matches = await pb.collection('matches').getFullList();
      expect(matches).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('returns 409 when user swipes same profile twice', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // First swipe
      await app.fetch(
        new Request(`http://localhost/users/${alice.id}/swipes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: bob.id, action: 'like' }),
        })
      );

      // Duplicate swipe
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Already swiped this profile');
    });

    it('returns 400 when profileId is missing', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);

      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like' }), // Missing profileId
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when action is invalid', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'invalid' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(400);
    });

    it('returns 404 when user does not exist', async () => {
      const app = createApp();
      const bob = await seedUser(bobMenteeNYC);
      const fakeUserId = 'nonexistentid123';

      const req = new Request(`http://localhost/users/${fakeUserId}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('returns 404 when profile does not exist', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const fakeProfileId = 'nonexistentid456';

      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: fakeProfileId, action: 'like' }),
      });
      const res = await app.fetch(req);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });
  });

  describe('Database Persistence', () => {
    it('persists swipe record correctly', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      await app.fetch(req);

      const swipes = await pb.collection('user_swipes').getFullList();
      expect(swipes).toHaveLength(1);
      expect(swipes[0].user).toBe(alice.id);
      expect(swipes[0].profile).toBe(bob.id);
      expect(swipes[0].action).toBe('like');
      expect(swipes[0].created).toBeDefined();
    });

    it('persists match record correctly', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Bob likes Alice
      await pb.collection('user_swipes').create({
        user: bob.id,
        profile: alice.id,
        action: 'like',
      });

      // Alice likes Bob back
      const req = new Request(`http://localhost/users/${alice.id}/swipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: bob.id, action: 'like' }),
      });
      await app.fetch(req);

      const matches = await pb.collection('matches').getFullList();
      expect(matches).toHaveLength(1);
      expect(matches[0].user1).toBe(alice.id < bob.id ? alice.id : bob.id);
      expect(matches[0].user2).toBe(alice.id < bob.id ? bob.id : alice.id);
      expect(matches[0].conversationStarted).toBe(false);
      expect(matches[0].matchedAt).toBeDefined();
    });

    it('handles multiple swipes from same user to different profiles', async () => {
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);
      const carol = await seedUser(carolMenteeNYC);

      // Alice likes Bob
      await app.fetch(
        new Request(`http://localhost/users/${alice.id}/swipes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: bob.id, action: 'like' }),
        })
      );

      // Alice likes Carol
      await app.fetch(
        new Request(`http://localhost/users/${alice.id}/swipes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId: carol.id, action: 'like' }),
        })
      );

      const swipes = await pb.collection('user_swipes').getFullList();
      expect(swipes).toHaveLength(2);
    });
  });
});
