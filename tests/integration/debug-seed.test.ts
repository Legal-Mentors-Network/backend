import { describe, it, expect, beforeEach } from 'vitest';
import { authenticate } from '../../src/models/User';
import { pb } from '../../src/pocketbase';
import { cleanDatabase, seedUser } from '../helpers/database';
import { aliceMentorNYC, bobMenteeNYC } from '../helpers/fixtures';

describe('Debug Seed', () => {
  beforeEach(async () => {
    await authenticate();
    await cleanDatabase();
  });

  it('can seed a user', async () => {
    try {
      const alice = await seedUser(aliceMentorNYC);
      console.log('Alice seeded:', alice);
      expect(alice.id).toBeTruthy();
    } catch (error) {
      console.error('Seed error:', error);
      if (error && typeof error === 'object' && 'data' in error) {
        console.error('Error data:', JSON.stringify((error as any).data, null, 2));
      }
      if (error && typeof error === 'object' && 'response' in error) {
        console.error('Error response:', JSON.stringify((error as any).response, null, 2));
      }
      throw error;
    }
  });

  it('can seed bob', async () => {
    try {
      const bob = await seedUser(bobMenteeNYC);
      console.log('Bob seeded:', bob);
      expect(bob.id).toBeTruthy();
    } catch (error) {
      console.error('Seed error:', error);
      if (error && typeof error === 'object' && 'data' in error) {
        console.error('Error data:', JSON.stringify((error as any).data, null, 2));
      }
      if (error && typeof error === 'object' && 'response' in error) {
        console.error('Error response:', JSON.stringify((error as any).response, null, 2));
      }
      throw error;
    }
  });
});
