import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { ZodError } from 'zod';
import { NotFoundError, BadRequestError } from '../../src/lib/errors';

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof NotFoundError) {
    return c.json({ error: err.message }, 404);
  }
  if (err instanceof BadRequestError) {
    return c.json({ error: err.message }, 400);
  }
  if (err instanceof ZodError) {
    return c.json({ error: 'Validation failed', details: err.issues }, 400);
  }
  return c.json({ error: 'Internal server error' }, 500);
});

app.get('/test/invalid-uuid', () => {
  throw new BadRequestError('Invalid user ID format. Must be a valid UUID.');
});

app.get('/test/not-found', () => {
  throw new NotFoundError('User with id "123" not found');
});

describe('Error handling', () => {
  it('returns 400 for invalid UUID format', async () => {
    const res = await app.request('/test/invalid-uuid');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('UUID');
  });

  it('returns 404 when user not found', async () => {
    const res = await app.request('/test/not-found');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('not found');
  });
});
