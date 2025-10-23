import { z } from 'zod';
import { ClientResponseError } from 'pocketbase';
import haversine from 'haversine-distance';
import { pb } from '../pocketbase';
import { User } from './User';

// Zod schemas
export const connectionSchema = z.object({
  id: z.string(),
  initiator: z.string(),
  connections: z.array(z.string()),
});

// TypeScript types
export type Connection = z.infer<typeof connectionSchema>;

// PocketBase DTO type
type ConnectionDTO = {
  id: string;
  initiator: string;
  connections: string[];
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
};

/**
 * Transform PocketBase DTO to domain Connection model
 */
function transformConnection(dto: ConnectionDTO): Connection {
  return connectionSchema.parse({
    id: dto.id,
    initiator: dto.initiator,
    connections: dto.connections,
  });
}

/**
 * Check if two users are within each other's distance range
 */
function isWithinRange(currentUser: User, user: User): boolean {
  const distance = haversine(
    { latitude: currentUser.latitude, longitude: currentUser.longitude },
    { latitude: user.latitude, longitude: user.longitude }
  );

  // Convert distance from meters to kilometers
  const distanceInKm = distance / 1000;

  // If current user has no max distance (0), they accept any distance
  if (currentUser.maxDistance === 0) return true;
  if (distanceInKm > currentUser.maxDistance) return false;

  // If other user has no max distance (0), they accept any distance
  if (user.maxDistance === 0) return true;
  if (distanceInKm > user.maxDistance) return false;

  return true;
}

/**
 * Find matching users based on age, role, and location preferences
 */
export function findMatches(currentUser: User, users: User[]): User[] {
  return users.filter((user) => {
    // Check if user's age is within current user's preferences
    if (user.age < currentUser.minAge || user.age > currentUser.maxAge) {
      return false;
    }

    // Check if current user's age is within user's preferences
    if (currentUser.age < user.minAge || currentUser.age > user.maxAge) {
      return false;
    }

    // Check if users are within each other's distance range
    if (!isWithinRange(currentUser, user)) {
      return false;
    }

    return true;
  });
}

/**
 * Get existing connection for a user
 * Returns null if no connection exists
 */
export async function getConnection(userId: string): Promise<Connection | null> {
  try {
    const filter = `initiator="${userId}"`;
    const result = (await pb
      .collection('connections')
      .getFirstListItem(filter)) as ConnectionDTO;
    return transformConnection(result);
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new connection record for a user with matched user IDs
 */
export async function createConnection(
  userId: string,
  matchedUserIds: string[]
): Promise<Connection> {
  const data = {
    initiator: userId,
    connections: matchedUserIds,
  };
  const result = (await pb.collection('connections').create(data)) as ConnectionDTO;
  return transformConnection(result);
}

/**
 * Update an existing connection by adding new matched user IDs
 */
export async function updateConnection(
  connection: Connection,
  newMatchedUserIds: string[]
): Promise<Connection> {
  const data = {
    connections: [...connection.connections, ...newMatchedUserIds],
  };
  const result = (await pb
    .collection('connections')
    .update(connection.id, data)) as ConnectionDTO;
  return transformConnection(result);
}

/**
 * Save matches for a user (creates new connection or updates existing)
 */
export async function saveMatches(
  userId: string,
  matchedUsers: User[]
): Promise<Connection> {
  const matchedUserIds = matchedUsers.map((user) => user.id);

  const existingConnection = await getConnection(userId);

  if (!existingConnection) {
    return await createConnection(userId, matchedUserIds);
  }

  return await updateConnection(existingConnection, matchedUserIds);
}
