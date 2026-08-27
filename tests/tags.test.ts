import express from "express"
import request from "supertest"
import Telescope from "../src/api/Telescope.js"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"
import DB from "../src/api/DB.js"

const app = () => {
    const a = express()
    const t = Telescope.setup(a, {
        databaseDriver: MemoryDriver,
        getUser: () => ({id: 42, name: 'Mustafa', email: 'mustafa@a-group.ly'}),
    })
    a.get('/ok', (q, s) => s.send('ok'))
    a.get('/boom', (q, s) => s.status(500).send('boom'))
    a.get('/missing', (q, s) => s.status(404).send('nope'))
    return {a, t}
}

describe('tags', () => {
    beforeEach(async () => {
        DB.configure(MemoryDriver)
        DB.configureFilter(undefined)
        await DB.truncate()
    })

    it('tags a request with status, method, path and the authenticated user', async () => {
        const {a, t} = app()

        await request(a).get('/ok')

        const tags = (await DB.requests().get())[0].tags

        expect(tags).toContain('status:200')
        expect(tags).toContain('method:GET')
        expect(tags).toContain('path:/ok')
        expect(tags).toContain('Auth:42')
        expect(tags).toContain('email:mustafa@a-group.ly')

        t.stopPruning()
    })

    it('records the authenticated user on the entry itself', async () => {
        const {a, t} = app()

        await request(a).get('/ok')

        // What the panel's "Authenticated User" card reads.
        expect((await DB.requests().get())[0].content.user)
            .toEqual({id: 42, name: 'Mustafa', email: 'mustafa@a-group.ly'})

        t.stopPruning()
    })

    it('filters by status code', async () => {
        const {a, t} = app()

        await request(a).get('/ok')
        await request(a).get('/boom')
        await request(a).get('/missing')

        const errors = await DB.requests().get(50, 'status:500')

        expect(errors).toHaveLength(1)
        expect(errors[0].content.uri).toEqual('/boom')

        t.stopPruning()
    })

    it('finds a status by the bare code, without the tag prefix', async () => {
        const {a, t} = app()

        await request(a).get('/boom')
        await request(a).get('/ok')

        // Typing "500" into the search box should just work.
        expect(await DB.requests().get(50, '500')).toHaveLength(1)

        t.stopPruning()
    })

    it('filters by user', async () => {
        const {a, t} = app()

        await request(a).get('/ok')
        await request(a).get('/boom')

        expect(await DB.requests().get(50, 'Auth:42')).toHaveLength(2)
        expect(await DB.requests().get(50, 'Auth:99')).toHaveLength(0)
        expect(await DB.requests().get(50, 'mustafa@a-group.ly')).toHaveLength(2)

        t.stopPruning()
    })

    it('matches tags case-insensitively', async () => {
        const {a, t} = app()

        await request(a).get('/ok')

        expect(await DB.requests().get(50, 'auth:42')).toHaveLength(1)
        expect(await DB.requests().get(50, 'METHOD:get')).toHaveLength(1)

        t.stopPruning()
    })

    it('returns everything when no tag is given', async () => {
        const {a, t} = app()

        await request(a).get('/ok')
        await request(a).get('/boom')

        expect(await DB.requests().get(50, '')).toHaveLength(2)
        expect(await DB.requests().get(50)).toHaveLength(2)

        t.stopPruning()
    })

    it('filters before applying take, so a rare tag is not paged out', async () => {
        const {a, t} = app()

        // 20 noise entries, then the one that matters. Taking 5 first and
        // filtering after would find nothing.
        for (let i = 0; i < 20; i++) {
            await request(a).get('/ok')
        }
        await request(a).get('/boom')

        expect(await DB.requests().get(5, 'status:500')).toHaveLength(1)

        t.stopPruning()
    })

    it('serves the filter over the API the client actually calls', async () => {
        const {a, t} = app()

        // setup() registers the watcher; the panel's routes come from router().
        a.use('/', t.router())

        await request(a).get('/ok')
        await request(a).get('/boom')

        const response = await request(a)
            .post('/telescope-api/requests?tag=status:500&take=50')

        expect(response.body.entries).toHaveLength(1)
        expect(response.body.entries[0].content.uri).toEqual('/boom')

        t.stopPruning()
    })
})
