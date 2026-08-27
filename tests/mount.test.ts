import express from "express"
import request from "supertest"
import Telescope from "../src/api/Telescope.js"
import DB from "../src/api/DB.js"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"

describe('mounting', () => {
    beforeEach(() => {
        DB.configure(MemoryDriver)
    })

    it('serves the client at a custom prefix', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {path: '_debug'})

        app.use('/_debug', telescope.router())

        const response = await request(app).get('/_debug/requests')

        expect(response.status).toBe(200)
        expect(response.text).toContain('"path":"_debug"')
    })

    it('rewrites asset urls to the configured prefix', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {path: '_debug'})

        app.use('/_debug', telescope.router())

        const response = await request(app).get('/_debug/requests')

        expect(response.text).toContain('src="/_debug/app.js"')
        expect(response.text).not.toContain('/telescope/app.js')
    })

    it('does not hardcode Europe/Warsaw as the timezone', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {timezone: 'America/New_York'})

        app.use('/telescope', telescope.router())

        const response = await request(app).get('/telescope/requests')

        expect(response.text).toContain('"timezone":"America/New_York"')
        expect(response.text).not.toContain('Europe/Warsaw')
    })

    it('registers no client routes when enableClient is false', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {enableClient: false})

        app.use('/telescope', telescope.router())

        expect((await request(app).get('/telescope/requests')).status).toBe(404)
    })

    it('still records entries when the client is disabled', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {enableClient: false})

        app.use('/telescope', telescope.router())
        app.get('/thing', (req, res) => res.send('ok'))

        await request(app).get('/thing')

        expect((await DB.requests().get(10)).length).toBeGreaterThan(0)
    })

    it('toggles recording', async () => {
        const app = express()
        const telescope = Telescope.setup(app)

        app.use('/telescope', telescope.router())

        expect(telescope.recording).toBe(true)

        const response = await request(app).post('/telescope/telescope-api/toggle-recording')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({recording: false})
        expect(telescope.recording).toBe(false)
    })
})
