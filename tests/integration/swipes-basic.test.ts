import { describe, it, expect, beforeEach } from 'vitest';
import { authenticate } from '../../src/models/User';
import { pb } from '../../src/pocketbase';
import { cleanDatabase, seedUser } from '../helpers/database';
import { aliceMentorNYC, bobMenteeNYC } from '../helpers/fixtures';

describe('User Swipes Basic Operations', () => {
  beforeEach(async () => {
    await authenticate();
    await cleanDatabase();
  });

  it('can create a swipe record', async () => {
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);

    console.log('Alice ID:', alice.id);
    console.log('Bob ID:', bob.id);

    try {
      const swipe = await pb.collection('user_swipes').create({
        user: bob.id,
        profile: alice.id,
        action: 'like',
      });

      console.log('Swipe created:', JSON.stringify(swipe, null, 2));

      // Try to get the record back with all fields
      const retrieved = await pb.collection('user_swipes').getOne(swipe.id);
      console.log('Retrieved swipe:', JSON.stringify(retrieved, null, 2));

      expect(swipe.id).toBeTruthy();
    } catch (error) {
      console.error('Failed to create swipe:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        console.error('Error response:', JSON.stringify((error as any).response, null, 2));
      }
      throw error;
    }
  });

  it('can query swipes by profile', async () => {
    const alice = await seedUser(aliceMentorNYC);
    const bob = await seedUser(bobMenteeNYC);

    // Create swipe
    await pb.collection('user_swipes').create({
      user: bob.id,
      profile: alice.id,
      action: 'like',
    });

    try {
      // Query swipes where profile = alice.id
      const swipes = await pb.collection('user_swipes').getFullList({
        filter: `profile = "${alice.id}" AND action = "like"`,
      });

      console.log('Found swipes:', swipes.length);
      expect(swipes).toHaveLength(1);
      expect(swipes[0].user).toBe(bob.id);
    } catch (error) {
      console.error('Failed to query swipes:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        console.error('Error response:', JSON.stringify((error as any).response, null, 2));
      }
      throw error;
    }
  });
});
