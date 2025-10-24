import type { Context, Next } from 'hono';
import { authenticate } from '../models/User';

/**
 * Middleware to authenticate with PocketBase before processing requests
 * Ensures valid admin session exists for database operations
 */
export async function authMiddleware(c: Context, next: Next) {
  await authenticate();
  await next();
}
