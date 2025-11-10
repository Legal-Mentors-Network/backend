import type { User } from '../../src/models/User';

/**
 * Test user fixtures with descriptive names for easy understanding in tests
 * Coordinates are real locations for realistic distance testing
 */

// New York City coordinates
const NYC_COORDS = { latitude: 40.7128, longitude: -74.006 };

// Los Angeles coordinates
const LA_COORDS = { latitude: 34.0522, longitude: -118.2437 };

// Chicago coordinates
const CHICAGO_COORDS = { latitude: 41.8781, longitude: -87.6298 };

// Boston coordinates
const BOSTON_COORDS = { latitude: 42.3601, longitude: -71.0589 };

/**
 * Alice - Mentor in NYC
 * Age 30, looking for mentees 25-35, max 50km distance
 */
export const aliceMentorNYC: Omit<User, 'id'> = {
  name: 'Alice Mentor NYC',
  age: 30,
  role: 'Mentor',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 35,
    maxDistance: 50,
  },
};

/**
 * Bob - Mentee in NYC
 * Age 28, looking for mentors 28-40, no distance limit (for multi-match tests)
 */
export const bobMenteeNYC: Omit<User, 'id'> = {
  name: 'Bob Mentee NYC',
  age: 28,
  role: 'Mentee',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 28,
    maxAge: 40,
    maxDistance: 0, // No distance limit for multi-match testing
  },
};

/**
 * Carol - Mentee in NYC
 * Age 32, looking for mentors 30-45, max 100km distance
 */
export const carolMenteeNYC: Omit<User, 'id'> = {
  name: 'Carol Mentee NYC',
  age: 32,
  role: 'Mentee',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 30,
    maxAge: 45,
    maxDistance: 100,
  },
};

/**
 * David - Mentee in NYC (Too Young for Alice)
 * Age 20, outside Alice's age preference
 */
export const davidMenteeNYCTooYoung: Omit<User, 'id'> = {
  name: 'David Mentee NYC Too Young',
  age: 20,
  role: 'Mentee',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 35,
    maxDistance: 50,
  },
};

/**
 * Eve - Mentee in LA (Too Far)
 * Age 28, compatible age but too far from NYC
 */
export const eveMenteeLATooFar: Omit<User, 'id'> = {
  name: 'Eve Mentee LA Too Far',
  age: 28,
  role: 'Mentee',
  location: {
    city: 'Los Angeles',
    country: 'US',
    latitude: LA_COORDS.latitude,
    longitude: LA_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 35,
    maxDistance: 50,
  },
};

/**
 * Frank - Mentor in NYC (Same Role as Alice)
 * Should not match with Alice (both mentors)
 */
export const frankMentorNYC: Omit<User, 'id'> = {
  name: 'Frank Mentor NYC',
  age: 35,
  role: 'Mentor',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 40,
    maxDistance: 50,
  },
};

/**
 * Grace - Mentee in LA with maxDistance=0 (no distance preference)
 * Should match with Alice even though far away
 */
export const graceMenteeLANoDistanceLimit: Omit<User, 'id'> = {
  name: 'Grace Mentee LA No Distance Limit',
  age: 28,
  role: 'Mentee',
  location: {
    city: 'Los Angeles',
    country: 'US',
    latitude: LA_COORDS.latitude,
    longitude: LA_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 35,
    maxDistance: 0, // No distance preference
  },
};

/**
 * Henry - Mentor in NYC with maxDistance=0 (no distance preference)
 */
export const henryMentorNYCNoDistanceLimit: Omit<User, 'id'> = {
  name: 'Henry Mentor NYC No Distance Limit',
  age: 30,
  role: 'Mentor',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 35,
    maxDistance: 0,
  },
};

/**
 * Iris - Mentee in NYC (Age boundary - exactly minAge)
 * Age 25, exactly at Alice's minAge boundary
 */
export const irisMenteeNYCMinAge: Omit<User, 'id'> = {
  name: 'Iris Mentee NYC Min Age',
  age: 25,
  role: 'Mentee',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 40,
    maxDistance: 50,
  },
};

/**
 * Jack - Mentee in NYC (Age boundary - exactly maxAge)
 * Age 35, exactly at Alice's maxAge boundary
 */
export const jackMenteeNYCMaxAge: Omit<User, 'id'> = {
  name: 'Jack Mentee NYC Max Age',
  age: 35,
  role: 'Mentee',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 40,
    maxDistance: 50,
  },
};

/**
 * Karen - Mentee in NYC (Age boundary - just outside maxAge)
 * Age 36, just outside Alice's maxAge boundary
 */
export const karenMenteeNYCTooOld: Omit<User, 'id'> = {
  name: 'Karen Mentee NYC Too Old',
  age: 36,
  role: 'Mentee',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 40,
    maxDistance: 50,
  },
};

/**
 * Leo - Mentor in Chicago
 * Age 35, for multi-mentor matching tests
 */
export const leoMentorChicago: Omit<User, 'id'> = {
  name: 'Leo Mentor Chicago',
  age: 35,
  role: 'Mentor',
  location: {
    city: 'Chicago',
    country: 'US',
    latitude: CHICAGO_COORDS.latitude,
    longitude: CHICAGO_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 40,
    maxDistance: 0, // No distance limit
  },
};

/**
 * Maria - Mentor in Boston
 * Age 32, for multi-mentor matching tests
 */
export const mariaMentorBoston: Omit<User, 'id'> = {
  name: 'Maria Mentor Boston',
  age: 32,
  role: 'Mentor',
  location: {
    city: 'Boston',
    country: 'US',
    latitude: BOSTON_COORDS.latitude,
    longitude: BOSTON_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 40,
    maxDistance: 0, // No distance limit
  },
};

/**
 * Nina - Mentee in NYC who rejects Alice's age
 * Age 28, but requires mentors to be 32+, so Alice (30) doesn't qualify
 */
export const ninaMenteeNYCRejectsAlice: Omit<User, 'id'> = {
  name: 'Nina Mentee NYC Rejects Alice Age',
  age: 28,
  role: 'Mentee',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 32, // Alice is 30, so Nina rejects her
    maxAge: 45,
    maxDistance: 50,
  },
};

/**
 * Oscar - Mentee in NYC with maxDistance=0 (for testing mutual distance=0)
 */
export const oscarMenteeNYCNoDistanceLimit: Omit<User, 'id'> = {
  name: 'Oscar Mentee NYC No Distance Limit',
  age: 28,
  role: 'Mentee',
  location: {
    city: 'New York',
    country: 'US',
    latitude: NYC_COORDS.latitude,
    longitude: NYC_COORDS.longitude,
  },
  preferences: {
    minAge: 25,
    maxAge: 35,
    maxDistance: 0,
  },
};
