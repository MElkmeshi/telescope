import express from "express"
import request from "supertest"
import Telescope from "../src/api/Telescope.js"
import DB from "../src/api/DB.js"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"
import {WatcherEntryCollectionType} from "../src/api/WatcherEntry.js"

describe('concurrent requests', () => {
    beforeEach(async () => {
        DB.configure(MemoryDriver)

        await DB.truncate()
    })

    it('attributes a log to the request that emitted it', async () => {
        const app = express()

        Telescope.setup(app)

        // Logs after the fast request has already been handled. Watchers that
        // read the batch id at record time rather than request time will stamp
        // this entry with the fast request's batch.
        app.get('/slow', async (req, res) => {
            await new Promise(resolve => setTimeout(resolve, 40))

            console.log('emitted by slow')

            res.send('slow')
        })

        app.get('/fast', (req, res) => res.send('fast'))

        await Promise.all([
            request(app).get('/slow'),
            request(app).get('/fast'),
        ])

        const requests = await DB.entry(WatcherEntryCollectionType.request).get(10)
        const logs = await DB.entry(WatcherEntryCollectionType.log).get(10)

        const slowRequest = requests.find(
            (entry: any) => entry.content.uri === '/slow'
        )
        const slowLog = logs.find(
            (entry: any) => entry.content.message === 'emitted by slow'
        )

        expect(slowRequest).toBeDefined()
        expect(slowLog).toBeDefined()
        expect(slowLog!.batchId).toBe(slowRequest!.batchId)
    })

    it('gives each request its own batch id', async () => {
        const app = express()

        Telescope.setup(app)

        app.get('/a', (req, res) => res.send('a'))
        app.get('/b', (req, res) => res.send('b'))

        await Promise.all([
            request(app).get('/a'),
            request(app).get('/b'),
        ])

        const entries = await DB.entry(WatcherEntryCollectionType.request).get(10)

        expect(entries).toHaveLength(2)
        expect(new Set(entries.map(entry => entry.batchId)).size).toBe(2)
    })
})
