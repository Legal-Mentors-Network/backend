import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import match from './routes/match-user'

const app = new Hono()

app.get('/', (ctx) => ctx.text('Legal Mentors Network API'))
app.route('/match', match)

const port = 3000
console.log(`Server is running on port ${port}`)

serve({ fetch: app.fetch, port })
