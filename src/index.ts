import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { ZodError } from 'zod'
import { NotFoundError, BadRequestError, ValidationError, UnauthorizedError } from './lib/errors'
import discovery from './routes/discovery'
import swipes from './routes/swipes'
import likes from './routes/likes'
import matches from './routes/matches'

const app = new Hono()

// Global error handler
app.onError((err, c) => {
  // NotFoundError -> 404
  if (err instanceof NotFoundError) {
    return c.json({ error: err.message }, 404)
  }

  // BadRequestError -> 400
  if (err instanceof BadRequestError) {
    return c.json({ error: err.message }, 400)
  }

  // ValidationError -> 400
  if (err instanceof ValidationError) {
    return c.json({ error: err.message }, 400)
  }

  // UnauthorizedError -> 401
  if (err instanceof UnauthorizedError) {
    return c.json({ error: err.message }, 401)
  }

  // Zod validation errors -> 400
  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Validation failed',
        details: err.issues,
      },
      400
    )
  }

  // Log unexpected errors
  console.error('Unexpected error:', err)

  // Default 500
  return c.json({ error: 'Internal server error' }, 500)
})

app.get('/', (ctx) => ctx.text('Legal Mentors Network API'))

// Swipe-based matching endpoints
app.route('/users', discovery)  // GET /users/:userId/discovery
app.route('/users', swipes)     // POST /users/:userId/swipes
app.route('/users', likes)      // GET /users/:userId/likes/incoming
app.route('/users', matches)    // GET /users/:userId/matches

const port = 3000
console.log(`Server is running on port ${port}`)

serve({ fetch: app.fetch, port })
