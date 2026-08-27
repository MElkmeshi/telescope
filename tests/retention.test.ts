import express from "express"
import request from "supertest"
import Telescope from "../src/api/Telescope.js"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"
import DB from "../src/api/DB.js"
import {RequestWatcherEntry} from "../src/api/watchers/RequestWatcher.js"
import {WatcherEntryCollectionType} from "../src/api/WatcherEntry.js"

function entryAged(hoursAgo: number): RequestWatcherEntry
{
    const entry = new RequestWatcherEntry({
        hostname: 'test',
        response_status: 200,
        duration: 1,
        memory: 1,
        payload: {},
        headers: {},
        response_headers: {},
        response: 'ok',
    })

    entry.created_at = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()

    return entry
}

describe('retention', () => {
    beforeEach(async () => {
        DB.configure(MemoryDriver)
        DB.configureFilter(undefined)

        await DB.truncate()
    })

    it('prunes entries older than the cutoff and keeps the rest', async () => {
        const driver = new MemoryDriver()

        await driver.save(WatcherEntryCollectionType.request, entryAged(48))
        await driver.save(WatcherEntryCollectionType.request, entryAged(1))

        const pruned = await driver.prune(new Date(Date.now() - 24 * 60 * 60 * 1000))

        expect(pruned).toEqual(1)
        expect(await driver.get(WatcherEntryCollectionType.request)).toHaveLength(1)
    })

    it('caps stored entries per collection on write', async () => {
        const driver = new MemoryDriver({maxEntries: 3})

        for (let i = 0; i < 10; i++) {
            await driver.save(WatcherEntryCollectionType.request, entryAged(0))
        }

        expect(await driver.get(WatcherEntryCollectionType.request)).toHaveLength(3)
    })

    it('honours take, rather than returning the whole buffer', async () => {
        const driver = new MemoryDriver()

        for (let i = 0; i < 10; i++) {
            await driver.save(WatcherEntryCollectionType.request, entryAged(0))
        }

        expect(await driver.get(WatcherEntryCollectionType.request, 4)).toHaveLength(4)
        expect(await driver.get(WatcherEntryCollectionType.request)).toHaveLength(10)
    })

    it('prunes through Telescope using the configured retention window', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {
            databaseDriver: MemoryDriver,
            retentionHours: 24,
            pruneIntervalMs: 0,
        })

        await DB.requests().save(entryAged(48))
        await DB.requests().save(entryAged(2))

        expect(await telescope.prune()).toEqual(1)
        expect(await DB.requests().get()).toHaveLength(1)

        telescope.stopPruning()
    })

    it('keeps everything when retention is disabled', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {
            databaseDriver: MemoryDriver,
            retentionHours: 0,
        })

        await DB.requests().save(entryAged(1000))

        expect(await telescope.prune()).toEqual(0)
        expect(await DB.requests().get()).toHaveLength(1)
    })

    it('does not hold the process open, and does not stack timers', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {
            databaseDriver: MemoryDriver,
            pruneIntervalMs: 60_000,
        })

        // setup() already started one; a second call must be a no-op rather
        // than leaving an orphaned interval behind.
        telescope.startPruning()

        const timer = (telescope as any).pruneTimer

        expect(timer).toBeDefined()
        // An un-unref'd interval would keep a container alive for a debug tool.
        expect(timer.hasRef()).toBe(false)

        telescope.stopPruning()

        expect((telescope as any).pruneTimer).toBeUndefined()
    })
})

describe('sampling and filtering', () => {
    beforeEach(async () => {
        DB.configure(MemoryDriver)
        DB.configureFilter(undefined)

        await DB.truncate()
    })

    it('records nothing when the sample rate is 0', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {databaseDriver: MemoryDriver, sampleRate: 0})

        app.get('/', (q, s) => s.send('ok'))

        await request(app).get('/')

        expect(await DB.requests().get()).toHaveLength(0)

        telescope.stopPruning()
    })

    it('records everything when the sample rate is 1', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {databaseDriver: MemoryDriver, sampleRate: 1})

        app.get('/', (q, s) => s.send('ok'))

        await request(app).get('/')

        expect(await DB.requests().get()).toHaveLength(1)

        telescope.stopPruning()
    })

    it('drops a sampled-out batch whole, leaving no orphan entries', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {databaseDriver: MemoryDriver, sampleRate: 0})

        // A query recorded mid-request must inherit the batch's decision.
        // Storing it while dropping its request would orphan it in the UI.
        app.get('/', async (q, s) => {
            await DB.queries().save(entryAged(0) as any)

            s.send('ok')
        })

        await request(app).get('/')

        expect(await DB.requests().get()).toHaveLength(0)
        expect(await DB.queries().get()).toHaveLength(0)

        telescope.stopPruning()
    })

    it('still records entries raised outside any request', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {databaseDriver: MemoryDriver, sampleRate: 0})

        // Cron jobs and workers have no batch to inherit from; sampling only
        // ever thins request traffic.
        await DB.queries().save(entryAged(0) as any)

        expect(await DB.queries().get()).toHaveLength(1)

        telescope.stopPruning()
    })

    it('applies filter as the last word on an entry', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {
            databaseDriver: MemoryDriver,
            filter: (entry) => entry.content?.uri !== '/health',
        })

        app.get('/health', (q, s) => s.send('ok'))
        app.get('/real', (q, s) => s.send('ok'))

        await request(app).get('/health')
        await request(app).get('/real')

        const entries = await DB.requests().get()

        expect(entries).toHaveLength(1)
        expect(entries[0].content.uri).toEqual('/real')

        telescope.stopPruning()
    })

    it('treats an out-of-range sample rate as record-everything', async () => {
        const app = express()
        const telescope = Telescope.setup(app, {databaseDriver: MemoryDriver, sampleRate: 42})

        app.get('/', (q, s) => s.send('ok'))

        await request(app).get('/')

        expect(await DB.requests().get()).toHaveLength(1)

        telescope.stopPruning()
    })
})
