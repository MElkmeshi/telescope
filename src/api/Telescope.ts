import express, {Express} from 'express'
import DB from './DB.js'
import ClientRequestWatcher from "./watchers/ClientRequestWatcher.js"
import LogWatcher from "./watchers/LogWatcher.js"
import RequestWatcher from "./watchers/RequestWatcher.js"
import {randomUUID} from "node:crypto"
import {runWithContext} from "./context.js"
import {WatcherEntryCollectionType} from "./WatcherEntry.js"
import ErrorWatcher from "./watchers/ErrorWatcher.js"
import DumpWatcher from "./watchers/DumpWatcher.js"
import {ResolvedConfig, resolveConfig, TelescopeOptions} from "./config.js"
import {existsSync} from "node:fs"
import path from "node:path"

export type {TelescopeOptions, ResolvedConfig} from "./config.js"

export type Watcher =
    typeof RequestWatcher |
    typeof ErrorWatcher |
    typeof ClientRequestWatcher |
    typeof DumpWatcher |
    typeof LogWatcher

const DEFAULT_WATCHERS: Watcher[] = [
    RequestWatcher,
    ErrorWatcher,
    ClientRequestWatcher,
    DumpWatcher,
    LogWatcher
]

export default class Telescope
{
    public app: Express
    public readonly config: ResolvedConfig
    public readonly enabledWatchers: Watcher[]
    public recording = true

    constructor(app: Express, options?: TelescopeOptions)
    {
        this.app = app
        this.config = resolveConfig(options)
        this.enabledWatchers = (options?.enabledWatchers as Watcher[]) ?? DEFAULT_WATCHERS

        if (options?.databaseDriver) {
            DB.configure(options.databaseDriver)
        }
    }

    public static setup(app: Express, options?: TelescopeOptions)
    {
        const telescope = new Telescope(app, options)

        if (telescope.config.enableClient) {
            app.use(`/${telescope.config.path}`, telescope.config.isAuthorized)

            telescope.setUpApi()
            telescope.setUpStaticFiles()
        }

        app.use((request, response, next) => {
            if (!telescope.recording) {
                next()

                return
            }

            runWithContext({batchId: randomUUID()}, () => {
                telescope.isEnabled(RequestWatcher)
                && RequestWatcher.capture(request, response, telescope.config)

                next()
            })
        })

        telescope.isEnabled(ClientRequestWatcher)
        && ClientRequestWatcher.capture(telescope)

        telescope.isEnabled(LogWatcher)
        && LogWatcher.capture(telescope)

        return telescope
    }

    public isEnabled(watcher: Watcher): boolean
    {
        return this.enabledWatchers.includes(watcher)
    }

    public getEnabledWatchers(): string[]
    {
        return this.enabledWatchers.map((watcher) => watcher.entryType)
    }

    private setUpApi()
    {
        const prefix = `/${this.config.path}`

        this.app.post(`${prefix}/telescope-api/:entry`, async (request, response) => {
            const entries = await DB.entry(request.params.entry as WatcherEntryCollectionType).get(Number(request.query.take ?? 50))

            response.json({
                entries,
                status: "enabled"
            })
        })

        this.app.get(`${prefix}/telescope-api/:entry/:id`, async (request, response) => {
            const entry = await DB.entry(request.params.entry as WatcherEntryCollectionType).find(request.params.id)

            response.json({
                entry,
                batch: await DB.batch(entry?.batchId ?? '')
            })
        })

        this.app.delete(`${prefix}/telescope-api/entries`, async (request, response) => {
            await DB.truncate()

            response.send("OK")
        })

        this.app.get(`${prefix}/telescope-api/entries`, async (request, response) => {
            response.json({
                enabled: this.getEnabledWatchers()
            })
        })
    }

    private resolveDir(): string
    {
        let dir = process.cwd() + '/node_modules/@damianchojnacki/telescope/dist/'

        if (!existsSync(dir + 'index.html')) {
            dir = path.join(process.cwd(), '/dist/')
        }

        return dir
    }

    private setUpStaticFiles()
    {
        const dir = this.resolveDir()
        const prefix = `/${this.config.path}`

        this.app.use(`${prefix}/app.js`, express.static(dir + "app.js"))
        this.app.use(`${prefix}/app.css`, express.static(dir + "app.css"))
        this.app.use(`${prefix}/app-dark.css`, express.static(dir + "app-dark.css"))
        this.app.use(`${prefix}/favicon.ico`, express.static(dir + "favicon.ico"))

        this.getEnabledWatchers().forEach((watcher) => {
            this.app.use(`${prefix}/${watcher}`, express.static(dir + 'index.html'))
            this.app.use(`${prefix}/${watcher}/:id`, express.static(dir + 'index.html'))
        })

        this.app.get(`${prefix}/`, (request, response) => response.redirect(`${prefix}/requests`))
    }
}
