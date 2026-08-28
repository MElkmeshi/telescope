import express from "express"
import request from "supertest"
import Telescope from "../src/api/Telescope.js"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"

/**
 * The panel is a plain page — it never loads the host app's auth SDK, so
 * nothing in it refreshes a short-lived session cookie. Middleware such as
 * Clerk's will silently renew an expired session, but only on a GET; the
 * panel's own polling is POST, so an expiry surfaces to the user as a 401
 * that a manual reload appears to "fix".
 *
 * The keepalive exists to give that middleware a GET to renew on. It has no
 * body and does no work: everything that matters happens in the host's
 * middleware, above this route.
 */
describe('keepalive', () => {
    it('answers a GET with 204 and no body', async () => {
        const app = express()
        const t = Telescope.setup(app, {databaseDriver: MemoryDriver})

        app.use('/', t.router())

        const response = await request(app).get('/telescope-api/keepalive')

        expect(response.status).toEqual(204)
        expect(response.text).toBeFalsy()

        t.stopPruning()
    })

    it('sits behind isAuthorized, so it cannot be used to probe unauthenticated', async () => {
        const app = express()
        const t = Telescope.setup(app, {
            databaseDriver: MemoryDriver,
            isAuthorized: (q: any, s: any) => s.status(401).send('nope'),
        })

        app.use('/', t.router())

        expect((await request(app).get('/telescope-api/keepalive')).status).toEqual(401)

        t.stopPruning()
    })

    it('is not shadowed by the entry routes', async () => {
        const app = express()
        const t = Telescope.setup(app, {databaseDriver: MemoryDriver})

        app.use('/', t.router())

        // '/telescope-api/:entry/:id' is two segments and must not swallow it,
        // and the POST listing must stay POST-only.
        expect((await request(app).get('/telescope-api/keepalive')).status).toEqual(204)
        expect((await request(app).post('/telescope-api/keepalive')).status).toEqual(200)

        t.stopPruning()
    })
})
