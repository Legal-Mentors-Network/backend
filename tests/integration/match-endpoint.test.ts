import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { ZodError } from 'zod';
import { NotFoundError, BadRequestError, ValidationError, UnauthorizedError } from '../../src/lib/errors';
import matchRouter from '../../src/routes/match-user';
import { authenticate } from '../../src/models/User';
import { pb } from '../../src/pocketbase';
import { cleanDatabase, seedUser, seedUsers } from '../helpers/database';
import {
  aliceMentorNYC,
  bobMenteeNYC,
  carolMenteeNYC,
  davidMenteeNYCTooYoung,
  eveMenteeLATooFar,
  frankMentorNYC,
  graceMenteeLANoDistanceLimit,
  henryMentorNYCNoDistanceLimit,
  irisMenteeNYCMinAge,
  jackMenteeNYCMaxAge,
  karenMenteeNYCTooOld,
  leoMentorChicago,
  mariaMentorBoston,
  ninaMenteeNYCRejectsAlice,
  oscarMenteeNYCNoDistanceLimit,
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

  app.route('/match', matchRouter);

  return app;
}

describe('Match Endpoint Integration Tests', () => {
  beforeEach(async () => {
    // Authenticate with PocketBase before each test
    await authenticate();
    // Clean database before each test
    await cleanDatabase();
  });

  describe('Phase 1: Happy Paths', () => {
    it('returns single matched user when compatible mentee exists', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);
      await seedUser(davidMenteeNYCTooYoung); // Too young, won't match

      // Act
      const req = new Request(`http://localhost/match/${alice.id}`);
      const res = await app.fetch(req);

      // Debug: Log response if not 200
      if (res.status !== 200) {
        const errorData = await res.clone().json();
        console.error('Unexpected response status:', res.status);
        console.error('Error response:', JSON.stringify(errorData, null, 2));
      }

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.matches).toHaveLength(1);
      expect(data.matches[0].id).toBe(bob.id);
      expect(data.matches[0].name).toBe('Bob Mentee NYC');
      expect(data.message).toBe('Found 1 connection');

      // Verify connection was saved to database
      const connections = await pb.collection('connections').getFullList();
      expect(connections).toHaveLength(1);
      expect(connections[0].initiator).toBe(alice.id);
      expect(connections[0].connections).toContain(bob.id);
    });

    it('returns multiple matched users when several compatible candidates exist', async () => {
      // Arrange
      const app = createApp();
      const bob = await seedUser(bobMenteeNYC);
      const alice = await seedUser(aliceMentorNYC);
      const leo = await seedUser(leoMentorChicago);
      const maria = await seedUser(mariaMentorBoston);
      const frank = await seedUser(frankMentorNYC);

      // Act - Bob requesting mentors
      const req = new Request(`http://localhost/match/${bob.id}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.matches).toHaveLength(4); // All 4 mentors should match
      expect(data.message).toBe('Found 4 connections');

      // Verify all matched users are in the response
      const matchedIds = data.matches.map((u: any) => u.id);
      expect(matchedIds).toContain(alice.id);
      expect(matchedIds).toContain(leo.id);
      expect(matchedIds).toContain(maria.id);
      expect(matchedIds).toContain(frank.id);

      // Verify all have correct role
      data.matches.forEach((user: any) => {
        expect(user.role).toBe('Mentor');
      });
    });

    it('returns empty array with guidance message when no compatible users exist', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      // Seed only incompatible mentees
      await seedUser(davidMenteeNYCTooYoung); // Too young
      await seedUser(eveMenteeLATooFar); // Too far
      await seedUser(karenMenteeNYCTooOld); // Too old

      // Act
      const req = new Request(`http://localhost/match/${alice.id}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.matches).toEqual([]);
      expect(data.message).toContain('Could not find any connections');
      expect(data.message).toContain('broadening your search');

      // Verify NO connection was created in database
      const connections = await pb.collection('connections').getFullList();
      expect(connections).toHaveLength(0);
    });
  });

  describe('Phase 2: Validation & Persistence', () => {
    it('returns 400 when ID is empty', async () => {
      // Arrange
      const app = createApp();

      // Act
      const req = new Request('http://localhost/match/');
      const res = await app.fetch(req);

      // Assert - Empty ID should return 404 (no route match) or 400
      expect([400, 404]).toContain(res.status);
    });

    it('returns 404 when user ID does not exist in database', async () => {
      // Arrange
      const app = createApp();
      const fakeId = 'nonexistentid123'; // PocketBase-style ID that doesn't exist

      // Act
      const req = new Request(`http://localhost/match/${fakeId}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('creates new connection record on first match request', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Verify no connections exist initially
      const initialConnections = await pb.collection('connections').getFullList();
      expect(initialConnections).toHaveLength(0);

      // Act
      const req = new Request(`http://localhost/match/${alice.id}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const connections = await pb.collection('connections').getFullList();
      expect(connections).toHaveLength(1);
      expect(connections[0].initiator).toBe(alice.id);
      expect(connections[0].connections).toEqual([bob.id]);
    });

    it('appends to existing connection record on subsequent match requests', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // First match request
      const req1 = new Request(`http://localhost/match/${alice.id}`);
      await app.fetch(req1);

      // Verify first connection was created
      let connections = await pb.collection('connections').getFullList();
      expect(connections).toHaveLength(1);
      expect(connections[0].connections).toEqual([bob.id]);

      // Add a new compatible mentee
      const carol = await seedUser(carolMenteeNYC);

      // Act - Second match request
      const req2 = new Request(`http://localhost/match/${alice.id}`);
      const res2 = await app.fetch(req2);

      // Assert
      expect(res2.status).toBe(200);
      connections = await pb.collection('connections').getFullList();
      expect(connections).toHaveLength(1); // Still only 1 connection record
      expect(connections[0].initiator).toBe(alice.id);
      expect(connections[0].connections).toContain(bob.id);
      expect(connections[0].connections).toContain(carol.id);
      expect(connections[0].connections).toHaveLength(2);
    });

    it('returns complete user objects with all required fields', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC);

      // Act
      const req = new Request(`http://localhost/match/${alice.id}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.matches).toHaveLength(1);

      const user = data.matches[0];
      expect(user.id).toBe(bob.id);
      expect(user.name).toBe('Bob Mentee NYC');
      expect(user.age).toBe(28);
      expect(user.role).toBe('Mentee');
      expect(user.location).toEqual({
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
      });
      expect(user.preferences).toEqual({
        minAge: 28,
        maxAge: 40,
        maxDistance: 0,
      });
    });
  });

  describe('Phase 3: Algorithm Edge Cases', () => {
    it('matches users when maxDistance=0 regardless of physical distance', async () => {
      // Arrange
      const app = createApp();
      const henry = await seedUser(henryMentorNYCNoDistanceLimit); // NYC, maxDistance=0
      const grace = await seedUser(graceMenteeLANoDistanceLimit); // LA, maxDistance=0

      // Act
      const req = new Request(`http://localhost/match/${henry.id}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.matches).toHaveLength(1);
      expect(data.matches[0].id).toBe(grace.id);
      expect(data.matches[0].location).toEqual({
        city: 'Los Angeles',
        country: 'US',
        latitude: 34.0522,
        longitude: -118.2437,
      });
    });

    it('correctly includes users at exact age boundaries (minAge/maxAge)', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC); // minAge=25, maxAge=35
      const iris = await seedUser(irisMenteeNYCMinAge); // age=25 (exactly minAge)
      const jack = await seedUser(jackMenteeNYCMaxAge); // age=35 (exactly maxAge)
      await seedUser(davidMenteeNYCTooYoung); // age=20 (below minAge)
      await seedUser(karenMenteeNYCTooOld); // age=36 (above maxAge)

      // Act
      const req = new Request(`http://localhost/match/${alice.id}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.matches).toHaveLength(2);

      const matchedAges = data.matches.map((u: any) => u.age);
      expect(matchedAges).toContain(25); // Iris at min boundary
      expect(matchedAges).toContain(35); // Jack at max boundary
      expect(matchedAges).not.toContain(20); // David too young
      expect(matchedAges).not.toContain(36); // Karen too old
    });

    it('excludes users when age preferences are not mutual', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC); // age=30, wants 25-35
      const nina = await seedUser(ninaMenteeNYCRejectsAlice); // age=28, wants 32-45

      // Alice accepts Nina (28 is in 25-35)
      // But Nina rejects Alice (30 is not in 32-45)

      // Act
      const req = new Request(`http://localhost/match/${alice.id}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.matches).toHaveLength(0); // Nina should NOT be in matches
    });

    it('mentor only matches with mentees (role filtering)', async () => {
      // Arrange
      const app = createApp();
      const alice = await seedUser(aliceMentorNYC);
      const bob = await seedUser(bobMenteeNYC); // Mentee - should match
      const carol = await seedUser(carolMenteeNYC); // Mentee - should match
      const frank = await seedUser(frankMentorNYC); // Mentor - should NOT match

      // Act
      const req = new Request(`http://localhost/match/${alice.id}`);
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(200);
      const data = await res.json();

      // All matches should be Mentees only
      data.matches.forEach((user: any) => {
        expect(user.role).toBe('Mentee');
      });

      // Verify Frank (mentor) is NOT in matches
      const matchedIds = data.matches.map((u: any) => u.id);
      expect(matchedIds).not.toContain(frank.id);
    });
  });
});
