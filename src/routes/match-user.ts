import { Hono } from 'hono'
import { guard } from '../response'
import { getMatchedUsers, getMentees, getMentors, getUser } from '../services/user-service/service'
import { findMatches, save } from '../services/match-service/service'

const match = new Hono()

match.get('/:id', async (ctx) => guard(ctx, async () => {
    const id = ctx.req.param('id')
    const currentUser = await getUser(id)

    let users = [];

    switch (currentUser.role) {
        case 'Mentee': users = await getMentors(); break;
        case 'Mentor': users = await getMentees(); break;
    }

    const matches = findMatches(currentUser, users);

    if (matches.length === 0) {
        console.log('No matches found')
        return ctx.json({
            success: false,
            message: 'Could not find any connections that meet your search criteria. Try broadening your search to get more matches',
        })
    }

    const response = await save(currentUser.id, matches)
    const data = await getMatchedUsers(response.connections)

    return ctx.json({
        success: true,
        message: data.length === 1 ? 'Found 1 connection' : `Found ${data.length} connections`,
        data,
    })
}))

export default match