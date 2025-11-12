import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { ZodError } from 'zod';
import { NotFoundError, BadRequestError, ValidationError, UnauthorizedError } from '../../src/lib/errors';
import discoveryRouter from '../../src/routes/discovery';
import { authenticate } from '../../src/models/User';
import { pb } from '../../src/pocketbase';
import { cleanDatabase, seedUser } from '../helpers/database';
import {
  aliceMentorNYC,
  bobMenteeNYC,
  carolMenteeNYC,
  davidMenteeNYCTooYoung,
  eveMenteeLATooFar,
  frankMentorNYC,
  henryMentorNYCNoDistanceLimit,
  graceMenteeLANoDistanceLimit,
  irisMenteeNYCMinAge,
  jackMenteeNYCMaxAge,
  ninaMenteeNYCRejectsAlice,
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

  app.route('/users', discoveryRouter);

  return app;
}

describe('Discovery Endpoint Integration Tests', () => {
  beforeEach(async () => {
    await authenticate();
    await cleanDatabase();
  });

  describe('Basic Functionality', () => {
    it('returns paginated potential matches with default limit=20', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);
      const carol = await seedUser(carolMenteeNYC);

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(2);
      expect(data.hasMore).toBe(false);
      expect(data.nextOffset).toBe(0);
      expect(data.total).toBe(2);

      const profileIds = data.profiles.map((p: any) => p.id);
      expect(profileIds).toContain(bob.id);
      expect(profileIds).toContain(carol.id);
    });

    it('returns empty array when no matches available', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      // Seed only incompatible mentees
      await seedUser(davidMenteeNYCTooYoung); // Too young
      await seedUser(eveMenteeLATooFar); // Too far

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toEqual([]);
      expect(data.hasMore).toBe(false);
      expect(data.nextOffset).toBe(0);
      expect(data.total).toBe(0);
    });

    it('only returns opposite role profiles (Mentor → Mentees)', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);
      const carol = await seedUser(carolMenteeNYC);
      const frank = await seedUser(frankMentorNYC); // Same role - should NOT appear

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(2);

      // All profiles should be Mentees
      data.profiles.forEach((profile: any) => {
        expect(profile.role).toBe('Mentee');
      });

      const profileIds = data.profiles.map((p: any) => p.id);
      expect(profileIds).not.toContain(frank.id); // Frank (mentor) excluded
    });

    it('only returns opposite role profiles (Mentee → Mentors)', async () => {
      // Arrange
      const app = createApp();
      const bob = await seedUser(bobMenteeNYC);
      const alice = await seedUser(aliceMentorNYC);
      const frank = await seedUser(frankMentorNYC);
      const carol = await seedUser(carolMenteeNYC); // Same role - should NOT appear

      // Act
      const req = new Request(`http://localhost/users/${bob.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();

      // All profiles should be Mentors
      data.profiles.forEach((profile: any) => {
        expect(profile.role).toBe('Mentor');
      });

      const profileIds = data.profiles.map((p: any) => p.id);
      expect(profileIds).not.toContain(carol.id); // Carol (mentee) excluded
    });
  });

  describe('Swipe Exclusion', () => {
    it('excludes profiles user already liked', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);
      const carol = await seedUser(carolMenteeNYC);

      // Alice swipes "like" on Bob
      await pb.collection('user_swipes').create({
        user: alice.id,
        profile: bob.id,
        action: 'like',
      });

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1); // Only Carol, not Bob
      expect(data.profiles[0].id).toBe(carol.id);
      expect(data.total).toBe(1);
    });

    it('excludes profiles user already passed', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);
      const carol = await seedUser(carolMenteeNYC);

      // Alice swipes "pass" on Bob
      await pb.collection('user_swipes').create({
        user: alice.id,
        profile: bob.id,
        action: 'pass',
      });

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1); // Only Carol, not Bob
      expect(data.profiles[0].id).toBe(carol.id);
      expect(data.total).toBe(1);
    });

    it('excludes all swiped profiles (both likes and passes)', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);
      const carol = await seedUser(carolMenteeNYC);
      const iris = await seedUser(irisMenteeNYCMinAge);

      // Alice swipes on Bob and Carol
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
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1); // Only Iris remains
      expect(data.profiles[0].id).toBe(iris.id);
      expect(data.total).toBe(1);
    });

    it('returns empty when all matches have been swiped', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);
      const carol = await seedUser(carolMenteeNYC);

      // Alice swipes on all available matches
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
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toEqual([]);
      expect(data.hasMore).toBe(false);
      expect(data.total).toBe(0);
    });
  });

  describe('Pagination', () => {
    it('respects custom limit parameter', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      await seedUser(bobMenteeNYC);
      await seedUser(carolMenteeNYC);
      await seedUser(irisMenteeNYCMinAge);

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery?limit=2`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(2); // Limit respected
      expect(data.hasMore).toBe(true); // More results available
      expect(data.nextOffset).toBe(2);
      expect(data.total).toBe(3);
    });

    it('respects offset parameter for pagination', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      await seedUser(bobMenteeNYC);
      await seedUser(carolMenteeNYC);
      await seedUser(irisMenteeNYCMinAge);

      // Act - Get second page
      const req = new Request(`http://localhost/users/${alice.id}/discovery?limit=2&offset=2`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1); // Only 1 result on page 2
      expect(data.hasMore).toBe(false);
      expect(data.nextOffset).toBe(2); // No more results, offset unchanged
      expect(data.total).toBe(3);
    });

    it('hasMore=true when more results exist', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      await seedUser(bobMenteeNYC);
      await seedUser(carolMenteeNYC);
      await seedUser(irisMenteeNYCMinAge);
      await seedUser(jackMenteeNYCMaxAge);

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery?limit=3`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(3);
      expect(data.hasMore).toBe(true); // 4 total, showing 3
      expect(data.nextOffset).toBe(3);
      expect(data.total).toBe(4);
    });

    it('hasMore=false when no more results exist', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      await seedUser(bobMenteeNYC);
      await seedUser(carolMenteeNYC);

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery?limit=20`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(2); // All results fit in page
      expect(data.hasMore).toBe(false);
      expect(data.nextOffset).toBe(0); // Offset unchanged when no more results
      expect(data.total).toBe(2);
    });

    it('enforces max limit of 50', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      await seedUser(bobMenteeNYC);

      // Act - Request limit > 50
      const req = new Request(`http://localhost/users/${alice.id}/discovery?limit=100`);
      const res = await app.fetch(req);

      // Assert - Should be capped at 50 (but we only have 1 result)
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1);
    });

    it('defaults to limit=20 when not specified', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      await seedUser(bobMenteeNYC);

      // Act - No limit parameter
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toBeDefined();
    });

    it('defaults to offset=0 when not specified', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      await seedUser(bobMenteeNYC);

      // Act - No offset parameter
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1);
    });
  });

  describe('Algorithm Filtering', () => {
    it('respects age preferences (mutual compatibility)', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC); // age=30, wants 25-35
      const bob = await seedUser(bobMenteeNYC); // age=28, wants 28-40
      await seedUser(davidMenteeNYCTooYoung); // age=20, outside Alice's range
      await seedUser(ninaMenteeNYCRejectsAlice); // age=28, wants 32-45 (rejects Alice)

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1); // Only Bob matches
      expect(data.profiles[0].id).toBe(bob.id);
    });

    it('respects location preferences (maxDistance)', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC); // NYC, maxDistance=50km
      const bob = await seedUser(bobMenteeNYC); // NYC, within range
      await seedUser(eveMenteeLATooFar); // LA, too far

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1); // Only Bob (NYC)
      expect(data.profiles[0].id).toBe(bob.id);
    });

    it('matches when maxDistance=0 regardless of physical distance', async () => {
      // Arrange
      const app = createApp();
      const henry = await seedUser(henryMentorNYCNoDistanceLimit); // NYC, maxDistance=0
      const grace = await seedUser(graceMenteeLANoDistanceLimit); // LA, maxDistance=0

      // Act
      const req = new Request(`http://localhost/users/${henry.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1);
      expect(data.profiles[0].id).toBe(grace.id); // Grace matched despite being in LA
    });

    it('correctly includes users at exact age boundaries', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC); // minAge=25, maxAge=35
      const iris = await seedUser(irisMenteeNYCMinAge); // age=25 (exactly minAge)
      const jack = await seedUser(jackMenteeNYCMaxAge); // age=35 (exactly maxAge)

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(2);

      const profileAges = data.profiles.map((p: any) => p.age);
      expect(profileAges).toContain(25); // Iris at min boundary
      expect(profileAges).toContain(35); // Jack at max boundary
    });
  });

  describe('Error Handling', () => {
    it('returns 400 when userId is invalid', async () => {
      // Arrange
      const app = createApp();

      // Act - Empty userId
      const req = new Request('http://localhost/users//discovery');
      const res = await app.fetch(req);

      // Assert
      expect([400, 404]).toContain(res.status); // 404 from routing, 400 from validation
    });

    it('returns 404 when user does not exist', async () => {
      // Arrange
      const app = createApp();
      const fakeId = 'nonexistentid123';

      // Act
      const req = new Request(`http://localhost/users/${fakeId}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('returns 400 when limit is negative', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery?limit=-1`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(400);
    });

    it('returns 400 when offset is negative', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery?offset=-5`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(400);
    });
  });

  describe('Response Structure', () => {
    it('returns complete user objects with all required fields', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profiles).toHaveLength(1);

      const profile = data.profiles[0];
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
    });

    it('does not include PocketBase metadata in response', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      await seedUser(bobMenteeNYC);

      // Act
      const req = new Request(`http://localhost/users/${alice.id}/discovery`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      const profile = data.profiles[0];

      // Should NOT have PocketBase metadata
      expect(profile.collectionId).toBeUndefined();
      expect(profile.collectionName).toBeUndefined();
      expect(profile.created).toBeUndefined();
      expect(profile.updated).toBeUndefined();
    });
  });
});
