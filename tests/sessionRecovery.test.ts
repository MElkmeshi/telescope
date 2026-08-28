import axios from "axios"
import MockAdapter from "axios-mock-adapter"
// @ts-ignore — plain browser JS, transformed by babel-jest (see jest.config.js)
import * as sessionRecovery from "../src/client/sessionRecovery.js"

// babel-jest emits CJS, so the default lands one level deeper than the ESM
// importer expects. Unwrap once rather than reaching for esModuleInterop here.
const installSessionRecovery: any =
    (sessionRecovery as any).default?.default ?? (sessionRecovery as any).default

/**
 * The panel polls with POST, and session middleware only renews an expired
 * cookie on a GET. These cover the recovery that turns that mismatch from a
 * visible 401 into a non-event — including the cases where retrying would be
 * wrong.
 */
describe('session recovery', () => {
    let mock: MockAdapter
    let interceptor: number

    beforeEach(() => {
        mock = new MockAdapter(axios)
        interceptor = installSessionRecovery(axios, () => '/telescope')
    })

    afterEach(() => {
        axios.interceptors.response.eject(interceptor)
        mock.restore()
    })

    it('renews through the keepalive and replays the poll that 401d', async () => {
        let polls = 0

        mock.onGet('/telescope/telescope-api/keepalive').reply(204)
        mock.onPost('/telescope/telescope-api/requests').reply(() => {
            polls++

            // Expired the first time; the keepalive renews the cookie.
            return polls === 1 ? [401, 'expired'] : [200, {entries: []}]
        })

        const response = await axios.post('/telescope/telescope-api/requests')

        expect(response.status).toEqual(200)
        expect(polls).toEqual(2)
        expect(mock.history.get.filter(r => r.url!.endsWith('keepalive'))).toHaveLength(1)
    })

    it('spends exactly one keepalive when every poller trips at once', async () => {
        let keepalives = 0

        mock.onGet('/telescope/telescope-api/keepalive').reply(() => {
            keepalives++

            return [204]
        })
        mock.onPost(/requests|queries|models/).reply(config =>
            (config as any).telescopeRetried ? [200, {}] : [401, 'expired'])

        // Three screens polling concurrently, all holding the same dead cookie.
        await Promise.all([
            axios.post('/telescope/telescope-api/requests'),
            axios.post('/telescope/telescope-api/queries'),
            axios.post('/telescope/telescope-api/models'),
        ])

        expect(keepalives).toEqual(1)
    })

    it('gives up when the keepalive is refused, rather than retrying forever', async () => {
        mock.onGet('/telescope/telescope-api/keepalive').reply(401, 'signed out')
        mock.onPost('/telescope/telescope-api/requests').reply(401, 'signed out')

        // A genuine sign-out, not an expiry. The user must see the 401.
        await expect(axios.post('/telescope/telescope-api/requests')).rejects.toBeDefined()

        expect(mock.history.get.filter(r => r.url!.endsWith('keepalive'))).toHaveLength(1)
        expect(mock.history.post).toHaveLength(1)
    })

    it('leaves non-401 failures alone', async () => {
        mock.onGet('/telescope/telescope-api/keepalive').reply(204)
        mock.onPost('/telescope/telescope-api/requests').reply(500, 'boom')

        await expect(axios.post('/telescope/telescope-api/requests')).rejects.toBeDefined()

        expect(mock.history.get).toHaveLength(0)
    })

    it('reads the base path lazily, so an empty mount path still resolves', async () => {
        axios.interceptors.response.eject(interceptor)

        let base = '/telescope'
        interceptor = installSessionRecovery(axios, () => base)

        // app.js rewrites basePath to '' after installing, when path is '/'.
        base = ''

        mock.onGet('/telescope-api/keepalive').reply(204)
        mock.onPost('/telescope-api/requests').reply(config =>
            (config as any).telescopeRetried ? [200, {}] : [401, 'expired'])

        expect((await axios.post('/telescope-api/requests')).status).toEqual(200)
    })
})
