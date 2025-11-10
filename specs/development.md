# API Development Specifications

This document provides actionable guidance for agents working on the LMN API. Keep it concise and let it grow naturally.

## Project Structure

```
/api
  /src
    /routes       # Hono route handlers (thin, delegate to models)
    /models       # Business logic and database access
    /middleware   # Cross-cutting concerns (auth, logging)
    /lib          # Shared utilities (errors, helpers)
    index.ts      # App setup and global error handling
    pocketbase.ts # PocketBase client singleton
  /tests
    /unit         # Pure function logic tests
    /integration  # Full endpoint tests with real database
    /helpers      # Test utilities, fixtures, and data seeding
  package.json
  tsconfig.json
```

**File Naming:** kebab-case for files (e.g., `match-user.ts`, not `matchUser.ts`)

## Framework: Hono v4

**Setup Pattern:**

```typescript
// src/index.ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { ZodError } from 'zod'

const app = new Hono()

// Global error handler
app.onError((err, c) => {
  if (err instanceof NotFoundError) {
    return c.json({ error: err.message }, 404)
  }
  if (err instanceof ZodError) {
    return c.json({ error: 'Validation failed', details: err.issues }, 400)
  }
  console.error('Unexpected error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

// Mount routes
app.route('/match', matchRouter)

serve({ fetch: app.fetch, port: 3000 })
```

**Router Pattern:**

```typescript
// src/routes/feature.ts
import { Hono } from 'hono'
import type { Context } from 'hono'
import { authMiddleware } from '../middleware/auth'

const router = new Hono()

// Apply middleware
router.use('*', authMiddleware)

// Define routes
router.get('/:id', async (ctx: Context) => {
  const id = ctx.req.param('id')
  const result = await getFeatureById(id)
  return ctx.json(result)
})

export default router
```

**Key Principles:**
- Keep route handlers **thin** - delegate business logic to models
- Use middleware for cross-cutting concerns (auth, validation)
- Always return responses with `ctx.json()` or `ctx.text()`
- Throw custom errors for proper HTTP status mapping

## Validation: Zod v4

**Schema Definition:**

```typescript
import { z } from 'zod'

// Define schema
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  age: z.number(),
  role: z.enum(['Mentor', 'Mentee']),
})

// Infer TypeScript type
export type User = z.infer<typeof userSchema>
```

**Usage in Routes:**

```typescript
// Validate request parameters
const idSchema = z.string().min(1)
const id = ctx.req.param('id')
const validationResult = idSchema.safeParse(id)
if (!validationResult.success) {
  throw new BadRequestError('Invalid ID format')
}

// Validate response before returning
const response = responseSchema.parse(data)
return ctx.json(response)
```

**Best Practices:**
- Define schemas for all request/response bodies
- Use `.safeParse()` for graceful error handling
- Use `.parse()` when you want errors thrown and caught by global handler
- Export both schema and inferred type
- Colocate schemas with related models

## PocketBase Integration

**Client Setup:**

```typescript
// src/pocketbase.ts
import PocketBase from 'pocketbase'

const url = process.env.PB_URL
if (!url) {
  throw new Error('PB_URL environment variable is required')
}

export const pb = new PocketBase(url)
```

**Database Location:** `/db` at port 8091 (http://127.0.0.1:8091)

**Authentication Pattern:**

```typescript
// src/models/User.ts
export async function authenticate(): Promise<void> {
  const email = process.env.PB_ADMIN_EMAIL
  const password = process.env.PB_ADMIN_PASSWORD

  if (!email || !password) {
    throw new UnauthorizedError('Missing PocketBase admin credentials')
  }

  try {
    // PocketBase v0.30+ uses _superusers collection
    await pb.collection('_superusers').authWithPassword(email, password)
  } catch (error) {
    if (error instanceof ClientResponseError) {
      throw new UnauthorizedError(`Authentication failed: ${error.message}`)
    }
    throw new UnauthorizedError('Authentication failed')
  }
}
```

**Query Pattern:**

```typescript
// Get single item
const result = await pb
  .collection('users')
  .getFirstListItem(`id="${id}"`)

// Get list with filter
const results = await pb
  .collection('users')
  .getFullList({ filter: `role = "Mentor"` })

// Error handling
try {
  const user = await getUserById(id)
} catch (error) {
  if (error instanceof ClientResponseError && error.status === 404) {
    throw new NotFoundError('User not found')
  }
  throw error
}
```

**DTO Transformation Pattern:**

PocketBase returns raw database records with metadata. Transform them to clean domain models:

```typescript
// PocketBase DTO (what we get from database)
type UserDTO = {
  id: string
  name: string
  latitude: string  // PocketBase stores coordinates as strings
  longitude: string
  collectionId: string    // Metadata we don't need
  collectionName: string  // Metadata we don't need
  created: string         // Metadata we don't need
  updated: string         // Metadata we don't need
}

// Domain model (what we use in app)
type User = {
  id: string
  name: string
  latitude: number  // Parsed to number
  longitude: number
}

// Transformer function
function transformUser(dto: UserDTO): User {
  return userSchema.parse({
    id: dto.id,
    name: dto.name,
    latitude: parseFloat(dto.latitude),
    longitude: parseFloat(dto.longitude),
  })
}

// Usage in model function
export async function getUserById(id: string): Promise<User> {
  const result = await pb
    .collection('user_for_match')
    .getFirstListItem(`id="${id}"`) as UserDTO
  return transformUser(result)
}
```

**Benefits:**
- Removes PocketBase metadata from API responses
- Type coercion (string → number)
- Validation via Zod schema
- Clean separation between database layer and domain layer

## Error Handling

**Custom Error Classes:**

```typescript
// src/lib/errors.ts
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}
```

**Global Error Handler** (in `src/index.ts`):

Maps custom errors to HTTP status codes automatically:
- `NotFoundError` → 404
- `BadRequestError` → 400
- `ValidationError` → 400
- `UnauthorizedError` → 401
- `ZodError` → 400 with validation details
- All others → 500 (logged server-side)

**Usage:**

```typescript
// In route handlers or model functions
if (!isValid) {
  throw new BadRequestError('Invalid input')
}

if (!found) {
  throw new NotFoundError('Resource not found')
}

// The global error handler will catch these and return proper HTTP responses
```

## Middleware Pattern

**Authentication Middleware:**

```typescript
// src/middleware/auth.ts
import type { Context, Next } from 'hono'
import { authenticate } from '../models/User'

export async function authMiddleware(c: Context, next: Next) {
  await authenticate()  // Ensures PocketBase admin session exists
  await next()
}
```

**Apply to Routes:**

```typescript
const router = new Hono()
router.use('*', authMiddleware)  // All routes require auth
```

## TypeScript Configuration

**Strict Mode Enabled:**
- All code must satisfy TypeScript strict mode
- No `any` types unless absolutely necessary
- Explicit return types on exported functions
- Proper error type handling

**Example:**

```typescript
export async function getUserById(id: string): Promise<User> {
  // Implementation
}
```

## Testing Strategy

See `api/specs/testing.md` for comprehensive testing guidelines.

**Summary:**

- **Feature Tests (Integration):** Test full endpoints with real PocketBase database
  - No mocking of PocketBase client
  - Use test database on port 8092 (dev on 8091)
  - Clean database before each test

- **Unit Tests:** Only for pure business logic functions
  - No external dependencies (no mocking needed)
  - Test algorithms, calculations, transformations

**Run Tests:**

```bash
cd api
npm test  # Runs all tests with Vitest
```

## Development Workflow

### Starting the API

```bash
cd api
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
```

### Adding a New Endpoint

1. **Create route handler** in `src/routes/`:
   ```typescript
   // src/routes/feature.ts
   import { Hono } from 'hono'
   import { authMiddleware } from '../middleware/auth'

   const router = new Hono()
   router.use('*', authMiddleware)

   router.get('/:id', async (ctx) => {
     const result = await getFeatureById(ctx.req.param('id'))
     return ctx.json(result)
   })

   export default router
   ```

2. **Create model function** in `src/models/`:
   ```typescript
   // src/models/Feature.ts
   import { z } from 'zod'
   import { pb } from '../pocketbase'

   export const featureSchema = z.object({
     id: z.string(),
     name: z.string(),
   })

   export type Feature = z.infer<typeof featureSchema>

   type FeatureDTO = {
     id: string
     name: string
     collectionId: string
     collectionName: string
     created: string
     updated: string
   }

   function transformFeature(dto: FeatureDTO): Feature {
     return featureSchema.parse({
       id: dto.id,
       name: dto.name,
     })
   }

   export async function getFeatureById(id: string): Promise<Feature> {
     const result = await pb
       .collection('features')
       .getFirstListItem(`id="${id}"`) as FeatureDTO
     return transformFeature(result)
   }
   ```

3. **Mount route** in `src/index.ts`:
   ```typescript
   import feature from './routes/feature'
   app.route('/feature', feature)
   ```

4. **Write tests** in `tests/integration/`:
   ```typescript
   describe('GET /feature/:id', () => {
     beforeEach(async () => {
       await authenticate()
       await cleanDatabase()
     })

     it('returns feature by id', async () => {
       const feature = await seedFeature({ name: 'Test' })
       const req = new Request(`http://localhost/feature/${feature.id}`)
       const res = await app.fetch(req)

       expect(res.status).toBe(200)
       const data = await res.json()
       expect(data.name).toBe('Test')
     })
   })
   ```

### Environment Variables

Create `.env` file:

```bash
PB_URL=http://127.0.0.1:8091
PB_ADMIN_EMAIL=admin@lmn.com
PB_ADMIN_PASSWORD=admin123456
```

**Always validate required env vars on startup:**

```typescript
const requiredEnvVars = ['PB_URL', 'PB_ADMIN_EMAIL', 'PB_ADMIN_PASSWORD']
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} environment variable is required`)
  }
}
```

## Common Patterns

### Model File Structure

```typescript
// 1. Imports
import { z } from 'zod'
import { pb } from '../pocketbase'
import { NotFoundError } from '../lib/errors'

// 2. Zod schemas
export const entitySchema = z.object({
  id: z.string(),
  name: z.string(),
})

// 3. TypeScript types
export type Entity = z.infer<typeof entitySchema>

// 4. DTO types
type EntityDTO = {
  id: string
  name: string
  collectionId: string
  collectionName: string
  created: string
  updated: string
}

// 5. Transformer function
function transformEntity(dto: EntityDTO): Entity {
  return entitySchema.parse({
    id: dto.id,
    name: dto.name,
  })
}

// 6. Database functions
export async function getEntityById(id: string): Promise<Entity> {
  try {
    const result = await pb
      .collection('entities')
      .getFirstListItem(`id="${id}"`) as EntityDTO
    return transformEntity(result)
  } catch (error) {
    if (error instanceof ClientResponseError && error.status === 404) {
      throw new NotFoundError('Entity not found')
    }
    throw error
  }
}
```

### Route File Structure

```typescript
// 1. Imports
import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'

// 2. Create router
const router = new Hono()

// 3. Apply middleware
router.use('*', authMiddleware)

// 4. Define schemas
const requestSchema = z.object({
  // request validation
})

const responseSchema = z.object({
  // response validation
})

// 5. Define routes
router.get('/:id', async (ctx: Context) => {
  // Validate input
  // Call model functions
  // Validate output
  // Return response
})

// 6. Export router
export default router
```

## Critical Anti-Patterns

**DO NOT:**

1. Put business logic in route handlers - delegate to models
2. Skip input validation - always validate with Zod
3. Expose PocketBase metadata in API responses - transform DTOs
4. Use default auth store - authenticate as admin via middleware
5. Forget to handle `ClientResponseError` from PocketBase
6. Mock PocketBase in integration tests - use real database
7. Skip error type checking - use `instanceof` for proper handling
8. Use `any` types - maintain TypeScript strict mode
9. Return responses without validation - always validate output schemas
10. Forget to export routers with `export default`

## Security Considerations

- **Authentication:** Always use admin authentication via middleware
- **Input Validation:** Validate ALL user inputs with Zod schemas
- **Error Messages:** Never leak sensitive information in error messages
- **Environment Variables:** Check for required env vars on startup
- **PocketBase Queries:** Use parameterized filters to prevent injection
- **Admin Credentials:** Never expose in responses or logs

## Performance Optimization

- Use `getFirstListItem()` for single records (faster than `getFullList()` with limit)
- Filter queries in PocketBase instead of in application code
- Keep route handlers thin to minimize request processing time
- Use appropriate HTTP status codes for client caching

## Related Documentation

- **Testing Guidelines:** `api/specs/testing.md`
- **Project Overview:** `openspec/project.md`
- **Frontend Integration:** `mono/specs/development.md`
