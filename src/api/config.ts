import {NextFunction, Request, Response} from "express"
import {Driver} from "./DB.js"
import DatabaseDriver from "./drivers/DatabaseDriver.js"
import {GetUserFunction} from "./watchers/RequestWatcher.js"
import LowDriver from "./drivers/LowDriver.js"
import WatcherEntry from "./WatcherEntry.js"

export interface TelescopeOptions
{
    enabledWatchers?: any[]
    databaseDriver?: Driver | DatabaseDriver
    responseSizeLimit?: number
    paramsToHide?: string[]
    ignorePaths?: string[]
    clientIgnoreUrls?: string[]
    ignoreErrors?: ErrorConstructor[]
    isAuthorized?: (request: Request, response: Response, next: NextFunction) => void
    getUser?: GetUserFunction
    enableClient?: boolean
    path?: string
    slowQueryThreshold?: number
    timezone?: string

    /**
     * How long entries are kept. Entries older than this are deleted by the
     * background sweeper. Laravel's equivalent is `telescope:prune --hours`.
     * Set to 0 to keep everything, which is only sane for short-lived
     * processes — nothing else reclaims the space.
     */
    retentionHours?: number

    /**
     * Hard ceiling on stored entries per collection, enforced on write.
     *
     * Retention alone cannot bound memory: a burst can store a million entries
     * inside one retention window. This is the backstop that keeps a long-lived
     * process from growing without limit between sweeps. 0 disables it.
     */
    maxEntries?: number

    /** How often the sweeper runs. Defaults to every 10 minutes. */
    pruneIntervalMs?: number

    /**
     * Fraction of requests to record, 0..1. Applied once per batch, so a
     * recorded request keeps all of its queries and logs. Entries raised
     * outside a request are always recorded.
     */
    sampleRate?: number

    /**
     * Last word on whether an entry is stored. Runs per entry, after sampling.
     * Laravel's `Telescope::filter()`. Returning false drops that entry only.
     */
    filter?: (entry: WatcherEntry<any>) => boolean
}

export interface ResolvedConfig
{
    databaseDriver: Driver | DatabaseDriver
    responseSizeLimit: number
    paramsToHide: string[]
    ignorePaths: string[]
    clientIgnoreUrls: string[]
    ignoreErrors: ErrorConstructor[]
    isAuthorized: (request: Request, response: Response, next: NextFunction) => void
    getUser?: GetUserFunction
    enableClient: boolean
    path: string
    slowQueryThreshold: number
    timezone: string
    retentionHours: number
    maxEntries: number
    pruneIntervalMs: number
    sampleRate: number
    filter?: (entry: WatcherEntry<any>) => boolean
}

function defaultIsAuthorized(request: Request, response: Response, next: NextFunction): void
{
    if (process.env.NODE_ENV === "production") {
        response.status(403).send('Forbidden')

        return
    }

    next()
}

export function resolveConfig(options: TelescopeOptions = {}): ResolvedConfig
{
    const path = (options.path ?? 'telescope').replace(/^\/+|\/+$/g, '')

    return {
        databaseDriver: options.databaseDriver ?? LowDriver,
        responseSizeLimit: options.responseSizeLimit ?? 64,
        paramsToHide: options.paramsToHide ?? ['password', 'token', '_csrf'],
        // Telescope's own UI polls its API continuously; recording that
        // traffic floods the request list with self-inflicted noise.
        ignorePaths: [...(options.ignorePaths ?? []), `/${path}*`],
        clientIgnoreUrls: options.clientIgnoreUrls ?? [],
        ignoreErrors: options.ignoreErrors ?? [],
        isAuthorized: options.isAuthorized ?? defaultIsAuthorized,
        getUser: options.getUser,
        // `?? true` rather than a truthiness check: `enableClient: false` is
        // the only value anyone passes, and must survive.
        enableClient: options.enableClient ?? true,
        path,
        slowQueryThreshold: options.slowQueryThreshold ?? 100,
        timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        // 24h matches `telescope:prune`'s default.
        retentionHours: options.retentionHours ?? 24,
        maxEntries: options.maxEntries ?? 10000,
        pruneIntervalMs: options.pruneIntervalMs ?? 10 * 60 * 1000,
        sampleRate: clampSampleRate(options.sampleRate),
        filter: options.filter,
    }
}

/**
 * An out-of-range sampleRate is a config mistake, and the safe reading of one
 * is "record everything" — silently recording ~nothing would look like
 * Telescope was broken rather than misconfigured.
 */
function clampSampleRate(rate?: number): number
{
    if (rate === undefined || Number.isNaN(rate)) {
        return 1
    }

    return Math.min(1, Math.max(0, rate))
}
