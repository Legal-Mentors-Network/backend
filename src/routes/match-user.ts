import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import {
  getUserById,
  getUsersByIds,
  getMentees,
  getMentors,
  userSchema,
} from '../models/User'
import { findMatches, saveMatches } from '../models/match'
import { BadRequestError } from '../lib/errors'
import { authMiddleware } from '../middleware/auth'

const match = new Hono()

// Apply auth middleware to all routes
match.use('*', authMiddleware)

// Request param schema
const uuidSchema = z.string().uuid()

// Response schema
const matchResponseSchema = z.object({
  matches: z.array(userSchema),
  message: z.string(),
})

/**
 * GET /match/:id
 * Find and return matches for a user based on their preferences
 */
match.get('/:id', async (ctx: Context) => {
  // Validate user ID param
  const id = ctx.req.param('id')
  const validationResult = uuidSchema.safeParse(id)
  if (!validationResult.success) {
    throw new BadRequestError('Invalid user ID format. Must be a valid UUID.')
  }

  // Get current user
  const currentUser = await getUserById(id)

  // Get potential matches based on user role
  let potentialMatches = []
  switch (currentUser.role) {
    case 'Mentee':
      potentialMatches = await getMentors()
      break
    case 'Mentor':
      potentialMatches = await getMentees()
      break
  }

  // Find matches based on preferences
  const matches = findMatches(currentUser, potentialMatches)

  if (matches.length === 0) {
    const response = matchResponseSchema.parse({
      matches: [],
      message:
        'Could not find any connections that meet your search criteria. Try broadening your search to get more matches',
    })
    return ctx.json(response)
  }

  // Save matches to database
  const connection = await saveMatches(currentUser.id, matches)

  // Get full user data for matched connections
  const matchedUsers = await getUsersByIds(connection.connections)

  // Validate and return response
  const response = matchResponseSchema.parse({
    matches: matchedUsers,
    message:
      matchedUsers.length === 1
        ? 'Found 1 connection'
        : `Found ${matchedUsers.length} connections`,
  })

  return ctx.json(response)
})

export default match