import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { ZodError } from 'zod';
import { NotFoundError, BadRequestError, ValidationError, UnauthorizedError, ConflictError } from '../../src/lib/errors';
import profilesRouter from '../../src/routes/profiles';
import { authenticate } from '../../src/models/User';
import { pb } from '../../src/pocketbase';
import { cleanDatabase } from '../helpers/database';

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
    if (err instanceof ConflictError) {
      return c.json({ error: err.message }, 409);
    }
    if (err instanceof ZodError) {
      return c.json({ error: 'Validation failed', details: err.issues }, 400);
    }
    console.error('Unexpected error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  });

  app.route('/profiles', profilesRouter);

  return app;
}

describe('Profile Creation API Integration Tests', () => {
  beforeEach(async () => {
    await authenticate();
    await cleanDatabase();
  });

  describe('Success Path', () => {
    it('creates a profile successfully with valid data', async () => {
      // Arrange
      const app = createApp();

      // Create a user first
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true, // Still in onboarding
      });

      const validProfileData = {
        userId: userAccount.id,
        name: 'John Doe',
        age: 30,
        role: 'mentor', // lowercase - should be transformed
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 25,
        maxAge: 35,
        maxDistance: 50,
        bio: 'Experienced mentor in software engineering',
        skills: ['JavaScript', 'TypeScript', 'React'],
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validProfileData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.userId).toBe(userAccount.id);
      expect(data.name).toBe('John Doe');
      expect(data.age).toBe(30);
      expect(data.role).toBe('Mentor'); // Capitalized
      expect(data.city).toBe('New York');
      expect(data.country).toBe('US');
      expect(data.latitude).toBe('40.7128'); // Converted to string
      expect(data.longitude).toBe('-74.006'); // Converted to string
      expect(data.minAge).toBe(25);
      expect(data.maxAge).toBe(35);
      expect(data.maxDistance).toBe(50);
      expect(data.bio).toBe('Experienced mentor in software engineering');
      expect(data.skills).toEqual(['JavaScript', 'TypeScript', 'React']);
      expect(data.created).toBeDefined();
      expect(data.updated).toBeDefined();
    });
  });

  describe('Age Validation', () => {
    it('rejects age below 18', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const invalidData = {
        userId: userAccount.id,
        name: 'Too Young',
        age: 17, // Invalid
        role: 'mentee',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 18,
        maxAge: 25,
        maxDistance: 50,
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects age above 120', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const invalidData = {
        userId: userAccount.id,
        name: 'Too Old',
        age: 121, // Invalid
        role: 'mentor',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 18,
        maxAge: 120,
        maxDistance: 50,
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('accepts age exactly 18', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const validData = {
        userId: userAccount.id,
        name: 'Just Eighteen',
        age: 18, // Valid boundary
        role: 'mentee',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 18,
        maxAge: 25,
        maxDistance: 50,
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(201);
    });

    it('accepts age exactly 120', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const validData = {
        userId: userAccount.id,
        name: 'Very Old',
        age: 120, // Valid boundary
        role: 'mentor',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 18,
        maxAge: 120,
        maxDistance: 50,
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(201);
    });
  });

  describe('Age Preference Validation', () => {
    it('rejects when maxAge is less than minAge', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const invalidData = {
        userId: userAccount.id,
        name: 'Invalid Preferences',
        age: 30,
        role: 'mentor',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 35,
        maxAge: 25, // Less than minAge - invalid
        maxDistance: 50,
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('maxAge must be greater than or equal to minAge');
    });

    it('accepts when maxAge equals minAge', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const validData = {
        userId: userAccount.id,
        name: 'Same Age Preference',
        age: 30,
        role: 'mentor',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 30,
        maxAge: 30, // Equal to minAge - valid
        maxDistance: 50,
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(201);
    });
  });

  describe('Duplicate Profile', () => {
    it('returns 409 when profile already exists for user', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const profileData = {
        userId: userAccount.id,
        name: 'First Profile',
        age: 30,
        role: 'mentor',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 25,
        maxAge: 35,
        maxDistance: 50,
      };

      // Create first profile
      const req1 = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      const res1 = await app.fetch(req1);
      expect(res1.status).toBe(201);

      // Act - Try to create duplicate profile
      const req2 = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profileData, name: 'Second Profile' }), // Different name
      });
      const res2 = await app.fetch(req2);

      // Assert
      expect(res2.status).toBe(409);
      const data = await res2.json();
      expect(data.error).toContain('Profile already exists for this user');
    });
  });

  describe('Additional Validation', () => {
    it('rejects maxDistance below 0', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const invalidData = {
        userId: userAccount.id,
        name: 'Invalid Distance',
        age: 30,
        role: 'mentor',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 25,
        maxAge: 35,
        maxDistance: -1, // Invalid
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(400);
    });

    it('rejects maxDistance above 500', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const invalidData = {
        userId: userAccount.id,
        name: 'Invalid Distance',
        age: 30,
        role: 'mentor',
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 25,
        maxAge: 35,
        maxDistance: 501, // Invalid
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(400);
    });

    it('transforms role from lowercase to capitalized', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const validData = {
        userId: userAccount.id,
        name: 'Test User',
        age: 30,
        role: 'mentee', // lowercase
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
        minAge: 25,
        maxAge: 35,
        maxDistance: 50,
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.role).toBe('Mentee'); // Should be capitalized
    });

    it('converts latitude and longitude to strings', async () => {
      // Arrange
      const app = createApp();
      const userAccount = await pb.collection('users').create({
        email: `test-${Date.now()}@example.com`,
        password: 'test123456',
        passwordConfirm: 'test123456',
        onboarding: true,
      });

      const validData = {
        userId: userAccount.id,
        name: 'Test User',
        age: 30,
        role: 'mentor',
        city: 'New York',
        country: 'US',
        latitude: 40.7128, // Number input
        longitude: -74.006, // Number input
        minAge: 25,
        maxAge: 35,
        maxDistance: 50,
      };

      // Act
      const req = new Request('http://localhost/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validData),
      });
      const res = await app.fetch(req);

      // Assert
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(typeof data.latitude).toBe('string');
      expect(typeof data.longitude).toBe('string');
      expect(data.latitude).toBe('40.7128');
      expect(data.longitude).toBe('-74.006');
    });
  });
});
