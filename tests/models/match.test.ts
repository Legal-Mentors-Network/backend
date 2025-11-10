import { describe, it, expect } from 'vitest';
import { findMatches } from '../../src/models/match';
import type { User } from '../../src/models/User';

describe('findMatches', () => {
  const createUser = (overrides: Partial<User> = {}): User => ({
    id: '1',
    name: 'Test User',
    age: 30,
    role: 'Mentor',
    location: {
      city: 'New York',
      country: 'US',
      latitude: 40.7128,
      longitude: -74.006,
    },
    preferences: {
      minAge: 25,
      maxAge: 35,
      maxDistance: 50,
    },
    ...overrides,
  });

  it('returns matches when age preferences align', () => {
    const currentUser = createUser({
      age: 30,
      preferences: { minAge: 25, maxAge: 35, maxDistance: 50 }
    });
    const candidate = createUser({
      id: '2',
      age: 28,
      preferences: { minAge: 28, maxAge: 32, maxDistance: 50 }
    });

    const matches = findMatches(currentUser, [candidate]);

    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('2');
  });

  it('excludes users outside current user age range', () => {
    const currentUser = createUser({
      preferences: { minAge: 25, maxAge: 35, maxDistance: 50 }
    });
    const tooYoung = createUser({ id: '2', age: 20 });
    const tooOld = createUser({ id: '3', age: 40 });

    const matches = findMatches(currentUser, [tooYoung, tooOld]);

    expect(matches).toHaveLength(0);
  });

  it('excludes users when current user outside their age range', () => {
    const currentUser = createUser({ age: 30 });
    const candidate = createUser({
      id: '2',
      preferences: { minAge: 35, maxAge: 40, maxDistance: 50 }
    });

    const matches = findMatches(currentUser, [candidate]);

    expect(matches).toHaveLength(0);
  });

  it('excludes users beyond distance range', () => {
    const currentUser = createUser({
      location: {
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
      },
      preferences: {
        minAge: 25,
        maxAge: 35,
        maxDistance: 10,
      },
    });
    const farAway = createUser({
      id: '2',
      location: {
        city: 'Los Angeles',
        country: 'US',
        latitude: 34.0522,
        longitude: -118.2437,
      },
      preferences: {
        minAge: 25,
        maxAge: 35,
        maxDistance: 10,
      },
    });

    const matches = findMatches(currentUser, [farAway]);

    expect(matches).toHaveLength(0);
  });

  it('includes users when maxDistance is 0 (no limit)', () => {
    const currentUser = createUser({
      location: {
        city: 'New York',
        country: 'US',
        latitude: 40.7128,
        longitude: -74.006,
      },
      preferences: {
        minAge: 25,
        maxAge: 35,
        maxDistance: 0,
      },
    });
    const farAway = createUser({
      id: '2',
      location: {
        city: 'Los Angeles',
        country: 'US',
        latitude: 34.0522,
        longitude: -118.2437,
      },
      preferences: {
        minAge: 25,
        maxAge: 35,
        maxDistance: 0,
      },
    });

    const matches = findMatches(currentUser, [farAway]);

    expect(matches).toHaveLength(1);
  });

  it('filters multiple candidates correctly', () => {
    const currentUser = createUser({
      age: 30,
      preferences: { minAge: 25, maxAge: 35, maxDistance: 100 }
    });
    const validMatch1 = createUser({ id: '2', age: 28 });
    const validMatch2 = createUser({ id: '3', age: 32 });
    const invalidAge = createUser({ id: '4', age: 20 });
    const invalidDistance = createUser({
      id: '5',
      location: {
        city: 'Los Angeles',
        country: 'US',
        latitude: 34.0522,
        longitude: -118.2437,
      },
      preferences: {
        minAge: 25,
        maxAge: 35,
        maxDistance: 10,
      },
    });

    const matches = findMatches(currentUser, [
      validMatch1,
      validMatch2,
      invalidAge,
      invalidDistance,
    ]);

    expect(matches).toHaveLength(2);
    expect(matches.map((m) => m.id)).toEqual(['2', '3']);
  });
});
