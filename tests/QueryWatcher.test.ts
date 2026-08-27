import DB from "../src/api/DB.js"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"
import QueryWatcher from "../src/api/watchers/QueryWatcher.js"
import {resolveConfig} from "../src/api/config.js"

describe('QueryWatcher', () => {
    beforeEach(async () => {
        DB.configure(MemoryDriver)

        await DB.truncate()
    })

    it('records the shape the client renders', async () => {
        await QueryWatcher.record(
            {sql: 'select 1', bindings: [1], time: 4, connection: 'pg'},
            resolveConfig()
        )

        const [entry] = await DB.queries().get(10)

        expect(entry.type).toEqual('query')
        expect(entry.content).toEqual({
            sql: 'select 1',
            bindings: [1],
            time: 4,
            slow: false,
            connection: 'pg',
        })
    })

    it('flags queries over the threshold as slow', async () => {
        await QueryWatcher.record(
            {sql: 'select pg_sleep(1)', time: 250},
            resolveConfig({slowQueryThreshold: 100})
        )

        const [entry] = await DB.queries().get(10)

        expect(entry.content.slow).toBe(true)
    })

    it('defaults bindings and connection', async () => {
        await QueryWatcher.record({sql: 'select 1', time: 1}, resolveConfig())

        const [entry] = await DB.queries().get(10)

        expect(entry.content.bindings).toEqual([])
        expect(entry.content.connection).toBe('default')
    })
})
