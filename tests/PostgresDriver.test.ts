import {Pool} from "pg"
import PostgresDriver, {schemaSql} from "../src/api/drivers/PostgresDriver.js"
import {RequestWatcherEntry} from "../src/api/watchers/RequestWatcher.js"
import {QueryWatcherEntry} from "../src/api/watchers/QueryWatcher.js"
import {WatcherEntryCollectionType} from "../src/api/WatcherEntry.js"

/**
 * Runs against a real Postgres. Point TELESCOPE_TEST_DATABASE_URL somewhere
 * disposable; without a reachable server the suite reports itself skipped
 * rather than failing, so CI without a database stays green.
 */
const url = process.env.TELESCOPE_TEST_DATABASE_URL
    ?? 'postgres://localhost:5432/telescope_test'

let pool: Pool
let available = false

function entry(overrides: {hoursAgo?: number, batchId?: string, uri?: string} = {}): RequestWatcherEntry
{
    const e = new RequestWatcherEntry({
        hostname: 'test',
        uri: overrides.uri ?? '/',
        response_status: 200,
        duration: 1,
        memory: 1,
        payload: {},
        headers: {},
        response_headers: {},
        response: 'ok',
    }, overrides.batchId)

    if (overrides.hoursAgo) {
        e.created_at = new Date(Date.now() - overrides.hoursAgo * 3600_000).toISOString()
    }

    return e
}

function driver(options: {maxEntries?: number} = {}): PostgresDriver
{
    return new PostgresDriver({pool, maxEntries: options.maxEntries})
}

beforeAll(async () => {
    pool = new Pool({connectionString: url})

    try {
        await pool.query('SELECT 1')

        available = true
    } catch {
        console.warn(`[skip] no Postgres at ${url}`)
    }
})

afterAll(async () => {
    await pool?.end()
})

beforeEach(async () => {
    if (!available) {
        return
    }

    await pool.query('DROP TABLE IF EXISTS telescope_entries')
})

describe('PostgresDriver', () => {
    it('creates its schema on first use', async () => {
        if (!available) return

        await driver().get(WatcherEntryCollectionType.request)

        const {rows} = await pool.query(
            "SELECT to_regclass('telescope_entries') AS table"
        )

        expect(rows[0].table).toEqual('telescope_entries')
    })

    it('saves and reads back entries newest first, honouring take', async () => {
        if (!available) return

        const d = driver()

        await d.save(WatcherEntryCollectionType.request, entry({hoursAgo: 3, uri: '/old'}))
        await d.save(WatcherEntryCollectionType.request, entry({uri: '/new'}))

        const all = await d.get(WatcherEntryCollectionType.request)

        expect(all).toHaveLength(2)
        expect(all[0].content.uri).toEqual('/new')
        expect(await d.get(WatcherEntryCollectionType.request, 1)).toHaveLength(1)
    })

    it('survives a restart, unlike the in-memory driver', async () => {
        if (!available) return

        await driver().save(WatcherEntryCollectionType.request, entry({uri: '/persisted'}))

        // A second driver instance stands in for a fresh process.
        const entries = await driver().get(WatcherEntryCollectionType.request)

        expect(entries[0].content.uri).toEqual('/persisted')
    })

    it('finds one entry by id', async () => {
        if (!available) return

        const d = driver()
        const saved = entry()

        await d.save(WatcherEntryCollectionType.request, saved)

        expect((await d.find(WatcherEntryCollectionType.request, saved.id))?.id).toEqual(saved.id)
        expect(await d.find(WatcherEntryCollectionType.request, 'nope')).toBeUndefined()
    })

    it('resolves a batch across collections', async () => {
        if (!available) return

        const d = driver()

        await d.save(WatcherEntryCollectionType.request, entry({batchId: 'batch-1'}))
        await d.save(WatcherEntryCollectionType.query, new QueryWatcherEntry({
            hostname: 'test', connection: 'pg', time: 1, sql: 'select 1', bindings: [], slow: false,
        }, 'batch-1'))
        await d.save(WatcherEntryCollectionType.request, entry({batchId: 'batch-2'}))

        expect(await d.batch('batch-1')).toHaveLength(2)
        expect(await d.batch('')).toHaveLength(0)
    })

    it('prunes by age', async () => {
        if (!available) return

        const d = driver()

        await d.save(WatcherEntryCollectionType.request, entry({hoursAgo: 48}))
        await d.save(WatcherEntryCollectionType.request, entry({hoursAgo: 1}))

        expect(await d.prune(new Date(Date.now() - 24 * 3600_000))).toEqual(1)
        expect(await d.get(WatcherEntryCollectionType.request)).toHaveLength(1)
    })

    it('trims to maxEntries when pruning', async () => {
        if (!available) return

        const d = driver({maxEntries: 3})

        for (let i = 0; i < 8; i++) {
            await d.save(WatcherEntryCollectionType.request, entry({hoursAgo: i}))
        }

        await d.prune(new Date(Date.now() - 1000 * 3600_000))

        expect(await d.get(WatcherEntryCollectionType.request, 100)).toHaveLength(3)
    })

    it('replaces the entry at an index and moves it to the front', async () => {
        if (!available) return

        const d = driver()

        await d.save(WatcherEntryCollectionType.request, entry({hoursAgo: 2, uri: '/second'}))
        await d.save(WatcherEntryCollectionType.request, entry({hoursAgo: 1, uri: '/first'}))

        // Index 1 is '/second' in newest-first order — the dedup path
        // ErrorWatcher uses when the same error recurs.
        await d.update(WatcherEntryCollectionType.request, 1, entry({uri: '/replacement'}))

        const entries = await d.get(WatcherEntryCollectionType.request)

        expect(entries).toHaveLength(2)
        expect(entries[0].content.uri).toEqual('/replacement')
        expect(entries.map(e => e.content.uri)).not.toContain('/second')
    })

    it('truncates', async () => {
        if (!available) return

        const d = driver()

        await d.save(WatcherEntryCollectionType.request, entry())
        await d.truncate()

        expect(await d.get(WatcherEntryCollectionType.request)).toHaveLength(0)
    })

    it('stores content containing a circular reference', async () => {
        if (!available) return

        const d = driver()
        const circular: any = {name: 'req'}
        circular.self = circular

        const e = entry()
        e.content.payload = circular

        // JSON.stringify would throw here, on the request path, losing the
        // entry and whatever called it.
        await expect(d.save(WatcherEntryCollectionType.request, e)).resolves.toBeUndefined()

        const stored = await d.get(WatcherEntryCollectionType.request)

        expect(stored[0].content.payload.self).toEqual('[Circular]')
    })

    it('rejects a table name that is not a plain identifier', () => {
        // The name is interpolated into SQL, so this is the guard that keeps it
        // from being an injection point.
        expect(() => new PostgresDriver({pool, tableName: 'x; DROP TABLE users --'}))
            .toThrow(/Invalid Telescope table name/)
    })

    it('exposes its DDL for use as a real migration', () => {
        expect(schemaSql('custom_name')).toContain('CREATE TABLE IF NOT EXISTS custom_name')
    })
})
