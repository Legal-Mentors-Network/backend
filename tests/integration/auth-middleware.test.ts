import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/middleware/auth';
import { UnauthorizedError } from '../../src/lib/errors';

describe('Auth Middleware Integration Tests', () => {
  let originalEmail: string | undefined;
  let originalPassword: string | undefined;

  beforeEach(() => {
    // Store original env vars
    originalEmail = process.env.PB_ADMIN_EMAIL;
    originalPassword = process.env.PB_ADMIN_PASSWORD;
  });

  afterEach(() => {
    // Restore original env vars
    process.env.PB_ADMIN_EMAIL = originalEmail;
    process.env.PB_ADMIN_PASSWORD = originalPassword;
  });

  it('authenticates successfully with valid admin credentials', async () => {
    // Arrange
    const app = new Hono();
    app.use('*', authMiddleware);
    app.get('/test', (c) => c.json({ success: true }));

    // Ensure valid credentials are set
    process.env.PB_ADMIN_EMAIL = 'admin@lmn.com';
    process.env.PB_ADMIN_PASSWORD = 'admin123456';

    // Act
    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ success: true });
  });

  it('throws UnauthorizedError when PB_ADMIN_EMAIL is missing', async () => {
    // Arrange
    delete process.env.PB_ADMIN_EMAIL;
    process.env.PB_ADMIN_PASSWORD = 'admin123456';

    const app = new Hono();

    // Add error handler to convert errors to HTTP responses
    app.onError((err, c) => {
      if (err instanceof UnauthorizedError) {
        return c.json({ error: err.message }, 401);
      }
      return c.json({ error: 'Internal server error' }, 500);
    });

    app.use('*', authMiddleware);
    app.get('/test', (c) => c.json({ success: true }));

    // Act
    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Missing PocketBase admin credentials');
  });

  it('throws UnauthorizedError when PB_ADMIN_PASSWORD is missing', async () => {
    // Arrange
    process.env.PB_ADMIN_EMAIL = 'admin@lmn.com';
    delete process.env.PB_ADMIN_PASSWORD;

    const app = new Hono();

    // Add error handler
    app.onError((err, c) => {
      if (err instanceof UnauthorizedError) {
        return c.json({ error: err.message }, 401);
      }
      return c.json({ error: 'Internal server error' }, 500);
    });

    app.use('*', authMiddleware);
    app.get('/test', (c) => c.json({ success: true }));

    // Act
    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Missing PocketBase admin credentials');
  });

  it('throws UnauthorizedError when PocketBase rejects invalid credentials', async () => {
    // Arrange
    const app = new Hono();

    // Add error handler
    app.onError((err, c) => {
      if (err instanceof UnauthorizedError) {
        return c.json({ error: err.message }, 401);
      }
      return c.json({ error: 'Internal server error' }, 500);
    });

    app.use('*', authMiddleware);
    app.get('/test', (c) => c.json({ success: true }));

    // Set invalid credentials
    process.env.PB_ADMIN_EMAIL = 'wrong@example.com';
    process.env.PB_ADMIN_PASSWORD = 'wrongpassword';

    // Act
    const req = new Request('http://localhost/test');
    const res = await app.fetch(req);

    // Assert
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain('Authentication failed');
  });
});
