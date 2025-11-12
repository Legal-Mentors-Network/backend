import haversine from 'haversine-distance';
import { User } from './User';

/**
 * Check if two users are within each other's distance range
 */
function isWithinRange(currentUser: User, user: User): boolean {
  const distance = haversine(
    { latitude: currentUser.location.latitude, longitude: currentUser.location.longitude },
    { latitude: user.location.latitude, longitude: user.location.longitude }
  );

  // Convert distance from meters to kilometers
  const distanceInKm = distance / 1000;

  // If current user has no max distance (0), they accept any distance
  if (currentUser.preferences.maxDistance === 0) return true;
  if (distanceInKm > currentUser.preferences.maxDistance) return false;

  // If other user has no max distance (0), they accept any distance
  if (user.preferences.maxDistance === 0) return true;
  if (distanceInKm > user.preferences.maxDistance) return false;

  return true;
}

/**
 * Find matching users based on age, role, and location preferences
 */
export function findMatches(currentUser: User, users: User[]): User[] {
  return users.filter((user) => {
    // Check if user's age is within current user's preferences
    if (user.age < currentUser.preferences.minAge || user.age > currentUser.preferences.maxAge) {
      return false;
    }

    // Check if current user's age is within user's preferences
    if (currentUser.age < user.preferences.minAge || currentUser.age > user.preferences.maxAge) {
      return false;
    }

    // Check if users are within each other's distance range
    if (!isWithinRange(currentUser, user)) {
      return false;
    }

    return true;
  });
}
