import express, {Express, Router} from 'express'
import DB from './DB.js'
import ClientRequestWatcher from "./watchers/ClientRequestWatcher.js"
import LogWatcher from "./watchers/LogWatcher.js"
import RequestWatcher from "./watchers/RequestWatcher.js"
import {randomUUID} from "node:crypto"
import {runWithContext} from "./context.js"
import {WatcherEntryCollectionType} from "./WatcherEntry.js"
import ErrorWatcher from "./watchers/ErrorWatcher.js"
import DumpWatcher from "./watchers/DumpWatcher.js"
import QueryWatcher from "./watchers/QueryWatcher.js"
import {ResolvedConfig, resolveConfig, TelescopeOptions} from "./config.js"
import {readIndex, resolveClientDir} from "./client.js"
import {join} from "node:path"

export type {TelescopeOptions, ResolvedConfig} from "./config.js"

export type Watcher =
    typeof RequestWatcher |
    typeof ErrorWatcher |
    typeof ClientRequestWatcher |
    typeof DumpWatcher |
    typeof LogWatcher |
    typeof QueryWatcher

const DEFAULT_WATCHERS: Watcher[] = [
    RequestWatcher,
    ErrorWatcher,
    ClientRequestWatcher,
    DumpWatcher,
    LogWatcher,
    // No capture() of its own - entries arrive via wrapPool - but it must be
    // enabled so the queries route is registered and the nav item appears.
    QueryWatcher
]

export default class Telescope
{
    public app: Express
    public readonly config: ResolvedConfig
    public readonly enabledWatchers: Watcher[]
    public recording = true

    private pruneTimer?: ReturnType<typeof setInterval>

    constructor(app: Express, options?: TelescopeOptions)
    {
        this.app = app
        this.config = resolveConfig(options)
        this.enabledWatchers = (options?.enabledWatchers as Watcher[]) ?? DEFAULT_WATCHERS

        if (options?.databaseDriver) {
            DB.configure(options.databaseDriver, {maxEntries: this.config.maxEntries})
        }

        DB.configureFilter(this.config.filter)
    }

    public static setup(app: Express, options?: TelescopeOptions)
    {
        const telescope = new Telescope(app, options)

        app.use((request, response, next) => {
            if (!telescope.recording) {
                next()

                return
            }

            runWithContext({batchId: randomUUID(), shouldRecord: telescope.rollSample()}, () => {
                telescope.isEnabled(RequestWatcher)
                && RequestWatcher.capture(request, response, telescope.config)

                next()
            })
        })

        telescope.startPruning()

        telescope.isEnabled(ClientRequestWatcher)
        && ClientRequestWatcher.capture(telescope)

        telescope.isEnabled(LogWatcher)
        && LogWatcher.capture(telescope)

        return telescope
    }

    /** Sampling decision for one batch. */
    private rollSample(): boolean
    {
        return this.config.sampleRate >= 1 || Math.random() < this.config.sampleRate
    }

    /**
     * Delete everything older than the retention window. Safe to call by hand
     * — from a cron, a shutdown hook, or a test.
     */
    public async prune(): Promise<number>
    {
        if (this.config.retentionHours <= 0) {
            return 0
        }

        const before = new Date(Date.now() - this.config.retentionHours * 60 * 60 * 1000)

        return DB.prune(before)
    }

    /**
     * Start the background sweeper. The timer is unref'd so it never holds the
     * process open — a debug tool should not be the reason a container refuses
     * to exit — and it is idempotent, so repeated setup() calls in tests do not
     * stack timers.
     */
    public startPruning(): void
    {
        if (this.pruneTimer || this.config.retentionHours <= 0 || this.config.pruneIntervalMs <= 0) {
            return
        }

        this.pruneTimer = setInterval(() => {
            // A sweep failure must not take the process down: this runs
            // detached, so there is nobody to catch a rejection.
            this.prune().catch((error) => console.error('[telescope] prune failed', error))
        }, this.config.pruneIntervalMs)

        this.pruneTimer.unref?.()
    }

    public stopPruning(): void
    {
        if (this.pruneTimer) {
            clearInterval(this.pruneTimer)

            this.pruneTimer = undefined
        }
    }

    public isEnabled(watcher: Watcher): boolean
    {
        return this.enabledWatchers.includes(watcher)
    }

    public getEnabledWatchers(): string[]
    {
        return this.enabledWatchers.map((watcher) => watcher.entryType)
    }

    /**
     * Returns a Router for the caller to mount wherever they like. Mount it at
     * the same prefix given as `path` so the client's generated links resolve.
     */
    public router(): Router
    {
        const router = Router()

        if (!this.config.enableClient) {
            return router
        }

        router.use(this.config.isAuthorized)

        router.post('/telescope-api/toggle-recording', (request, response) => {
            this.recording = !this.recording

            response.json({recording: this.recording})
        })

        router.post('/telescope-api/:entry', async (request, response) => {
            const entries = await DB.entry(request.params.entry as WatcherEntryCollectionType).get(
                Number(request.query.take ?? 50),
                // The client always sends ?tag=, empty when the box is blank.
                typeof request.query.tag === 'string' ? request.query.tag : undefined,
            )

            response.json({
                entries,
                status: "enabled"
            })
        })

        router.get('/telescope-api/entries', async (request, response) => {
            response.json({
                enabled: this.getEnabledWatchers()
            })
        })

        router.delete('/telescope-api/entries', async (request, response) => {
            await DB.truncate()

            response.send("OK")
        })

        router.get('/telescope-api/:entry/:id', async (request, response) => {
            const entry = await DB.entry(request.params.entry as WatcherEntryCollectionType).find(request.params.id)

            response.json({
                entry,
                batch: await DB.batch(entry?.batchId ?? '')
            })
        })

        const dir = resolveClientDir()

        router.use('/app.js', express.static(join(dir, 'app.js')))
        router.use('/app.css', express.static(join(dir, 'app.css')))
        router.use('/app-dark.css', express.static(join(dir, 'app-dark.css')))
        router.use('/favicon.ico', express.static(join(dir, 'favicon.ico')))

        const serveIndex = (request: any, response: any) =>
            response.type('html').send(readIndex(this.config, this.recording))

        this.getEnabledWatchers().forEach((watcher) => {
            router.get(`/${watcher}`, serveIndex)
            router.get(`/${watcher}/:id`, serveIndex)
        })

        router.get('/', (request, response) => response.redirect(`/${this.config.path}/requests`))

        return router
    }
}
