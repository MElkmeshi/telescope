import express, {Express} from "express"
import Telescope from "../src/api/Telescope.js"
import RequestWatcher, {HTTPMethod, RequestWatcherEntry} from "../src/api/watchers/RequestWatcher.js"
import request from "supertest"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"
import DB from "../src/api/DB.js"
import {hostname} from "os"
import bodyParser from "body-parser"

describe('RequestWatcher', () => {
    beforeEach(async () => {
        DB.configure(MemoryDriver)

        await DB.truncate()
    })

    it('saves requests', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => response.send('Hello World'))

        await request(app)
            .get('/?foo=bar')

        const entry = (await DB.requests().get())[0]

        expect(entry).not.toBeUndefined()
        expect(entry.type).toEqual('request')
        expect(entry.content.hostname).toEqual(hostname())
        expect(entry.content.method).toEqual(HTTPMethod.GET)
        expect(entry.content.uri).toEqual('/')
        expect(entry.content.response_status).toEqual(200)
        expect(entry.content.payload).toEqual({foo: "bar"})
        expect(entry.content.response).toEqual("Hello World")
    })

    it('saves request params', async () => {
        const app = express()

        app.use(bodyParser.json())

        Telescope.setup(app)

        app.post('/', (request, response) => response.send('Hello World'))

        await request(app)
            .post('/')
            .send({foo: 'bar'})
            .set('Accept', 'application/json')

        const entry = (await DB.requests().get())[0]

        expect(entry.content.payload).toEqual({foo: "bar"})
    })

    it('can ignore request path', async () => {
        const app = express()

        Telescope.setup(app, {
            ignorePaths: ['/admin/products']
        })

        await expectCorrectRequestsLogged(app)
    })

    it('can ignore request wildcard path', async () => {
        const app = express()

        Telescope.setup(app, {
            ignorePaths: ['/admin*']
        })

        await expectCorrectRequestsLogged(app)
    })

    it('purges response', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => response.send('x'.repeat(1024 * 100)))

        await request(app)
            .get('/')

        const entry = (await DB.requests().get())[0]

        expect(entry.content.response).toEqual('Purged By Telescope')
    })

    it('can change response limit', async () => {
        const app = express()

        Telescope.setup(app, {
            responseSizeLimit: 80
        })

        app.get('/purge', (request, response) => response.send('x'.repeat(1024 * 90)))
        app.get('/not-purge', (request, response) => response.send('x'.repeat(1024 * 70)))

        await request(app)
            .get('/purge')

        await request(app)
            .get('/not-purge')

        const entries = (await DB.requests().get())

        expect(entries[1].content.response).toEqual('Purged By Telescope')
        expect(entries[0].content.response).not.toEqual('Purged By Telescope')
    })

    it('hides params', async () => {
        const app = express()

        app.use(bodyParser.json())

        Telescope.setup(app)

        app.post('/', (request, response) => response.send('Hello world'))

        await request(app)
            .post('/')
            .send({name: 'john', password: 'superSecretPassword'})
            .set('Accept', 'application/json')

        const entry = (await DB.requests().get())[0]

        expect(entry.content.payload).toEqual({name: 'john', password: '********'})
    })

    it('hides custom params', async () => {
        const app = express()

        app.use(bodyParser.json())

        Telescope.setup(app, {
            paramsToHide: ['foo']
        })

        app.post('/', (request, response) => response.send('Hello world'))

        await request(app)
            .post('/')
            .send({foo: 'bar'})
            .set('Accept', 'application/json')

        const entry = (await DB.requests().get())[0]

        expect(entry.content.payload).toEqual({foo: '********'})
    })

    it('stores a json response as an object, not as escaped text', async () => {
        const app = express()

        Telescope.setup(app)

        // res.json() serialises and calls res.send() with the string, so
        // without decoding the panel renders one long quoted blob.
        app.get('/', (request, response) => {
            response.json({isInWishlist: false, wishlistId: null, listingType: 'home'})
        })

        await request(app)
            .get('/')

        const entry = (await DB.requests().get())[0]

        expect(typeof entry.content.response).toEqual('object')
        expect(entry.content.response.isInWishlist).toEqual(false)
        expect(entry.content.response.wishlistId).toBeNull()
        expect(entry.content.response.listingType).toEqual('home')
    })

    it('stores a json array response as an array', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => response.json([{id: 1}, {id: 2}]))

        await request(app)
            .get('/')

        const entry = (await DB.requests().get())[0]

        expect(Array.isArray(entry.content.response)).toBe(true)
        expect(entry.content.response).toHaveLength(2)
    })

    it('leaves a non-json response as text', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => response.send('<h1>Hello</h1>'))

        await request(app)
            .get('/')

        expect((await DB.requests().get())[0].content.response).toEqual('<h1>Hello</h1>')
    })

    it('leaves a bare json scalar as the text that was sent', async () => {
        const app = express()

        Telescope.setup(app)

        // Valid JSON, but "5" reads better than the number it decodes to.
        app.get('/', (request, response) => response.send('5'))

        await request(app)
            .get('/')

        expect((await DB.requests().get())[0].content.response).toEqual('5')
    })

    it('masks hidden params inside a nested json response', async () => {
        const app = express()

        Telescope.setup(app, {paramsToHide: ['token']})

        app.get('/', (request, response) => {
            response.json({data: {session: {token: 'super-secret', id: 7}}})
        })

        await request(app)
            .get('/')

        const entry = (await DB.requests().get())[0]

        // Nested, because a credential one level down is the same credential.
        expect(entry.content.response.data.session.token).toEqual('********')
        expect(entry.content.response.data.session.id).toEqual(7)
        expect(JSON.stringify(entry.content.response)).not.toContain('super-secret')
    })

    it('saves response headers', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => {
            response.set('x-custom', 'value')

            response.send('Hello world')
        })

        await request(app)
            .get('/')

        const entry = (await DB.requests().get())[0]

        expect(entry.content.response_headers['x-custom']).toEqual('value')
    })

    it('hides set-cookie in response headers', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => {
            response.cookie('session', 'super-secret')

            response.send('Hello world')
        })

        await request(app)
            .get('/')

        const entry = (await DB.requests().get())[0]

        // The panel renders these in plain text, so the session credential must
        // never reach it — masked regardless of paramsToHide.
        expect(entry.content.response_headers['set-cookie']).toEqual('********')
        expect(JSON.stringify(entry.content.response_headers)).not.toContain('super-secret')
    })

    it('hides configured params in response headers', async () => {
        const app = express()

        Telescope.setup(app, {
            paramsToHide: ['x-api-key']
        })

        app.get('/', (request, response) => {
            response.set('X-Api-Key', 'secret-key')

            response.send('Hello world')
        })

        await request(app)
            .get('/')

        const entry = (await DB.requests().get())[0]

        // Express lower-cases outgoing header names, so the match must be
        // case-insensitive on both sides.
        expect(entry.content.response_headers['x-api-key']).toEqual('********')
    })

    it('saves request headers', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => response.send('Hello world'))

        await request(app)
            .get('/')
            .set('x-custom', 'value')

        const entry = (await DB.requests().get())[0]

        expect(entry.content.headers['x-custom']).toEqual('value')
    })

    it('hides the authorization request header', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => response.send('Hello world'))

        await request(app)
            .get('/')
            .set('Authorization', 'Bearer super-secret-jwt')

        const entry = (await DB.requests().get())[0]

        // A bearer token is a live credential: anyone reading the panel could
        // replay it as that user. Masked regardless of paramsToHide.
        expect(entry.content.headers['authorization']).toEqual('********')
        expect(JSON.stringify(entry.content.headers)).not.toContain('super-secret-jwt')
    })

    it('hides the cookie request header', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/', (request, response) => response.send('Hello world'))

        await request(app)
            .get('/')
            .set('Cookie', 'session=super-secret-session')

        const entry = (await DB.requests().get())[0]

        // The mirror of set-cookie on the response: a session cookie is a
        // credential by definition, whichever direction it travels in.
        expect(entry.content.headers['cookie']).toEqual('********')
        expect(JSON.stringify(entry.content.headers)).not.toContain('super-secret-session')
    })

    it('hides configured params in request headers', async () => {
        const app = express()

        Telescope.setup(app, {
            paramsToHide: ['x-api-key']
        })

        app.get('/', (request, response) => response.send('Hello world'))

        await request(app)
            .get('/')
            .set('X-Api-Key', 'secret-key')

        const entry = (await DB.requests().get())[0]

        // Node lower-cases incoming header names, so the match must be
        // case-insensitive on both sides.
        expect(entry.content.headers['x-api-key']).toEqual('********')
    })

    it('does not mutate the headers the application sees', async () => {
        const app = express()

        Telescope.setup(app)

        let seen: string | undefined

        app.get('/', (request, response) => {
            // Runs before save(), but the masking must not reach back into the
            // live request object that later middleware and handlers read.
            response.send('Hello world')

            seen = request.headers.authorization
        })

        await request(app)
            .get('/')
            .set('Authorization', 'Bearer super-secret-jwt')

        expect(seen).toEqual('Bearer super-secret-jwt')

        const entry = (await DB.requests().get())[0]

        expect(entry.content.headers['authorization']).toEqual('********')
    })

    async function expectCorrectRequestsLogged(app: Express){
        app.get('/', (request, response) => response.send('Hello World'))
        app.get('/admin/products', (request, response) => response.send('Hello World'))

        await request(app)
            .get('/')

        await request(app)
            .get('/admin/products')

        const entries = (await DB.requests().get())

        expect(entries).toHaveLength(1)
        expect(entries[0].content.uri).toEqual('/')
    }

    it('saves authenticated user', async () => {
        const app = express()

        const user = {
            id: 1,
            name: 'John',
            email: 'user@example.com'
        }

        Telescope.setup(app, {
            getUser: () => user
        })

        app.get('/', (request, response) => response.send('Hello world'))

        await request(app)
            .get('/')

        const entry = (await DB.requests().get())[0]

        expect(entry.content.user).toEqual(user)
    })
})