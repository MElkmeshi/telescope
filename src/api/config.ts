import {NextFunction, Request, Response} from "express"
import {Driver} from "./DB.js"
import {GetUserFunction} from "./watchers/RequestWatcher.js"
import LowDriver from "./drivers/LowDriver.js"

export interface TelescopeOptions
{
    enabledWatchers?: any[]
    databaseDriver?: Driver
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
}

export interface ResolvedConfig
{
    databaseDriver: Driver
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
    return {
        databaseDriver: options.databaseDriver ?? LowDriver,
        responseSizeLimit: options.responseSizeLimit ?? 64,
        paramsToHide: options.paramsToHide ?? ['password', 'token', '_csrf'],
        ignorePaths: options.ignorePaths ?? [],
        clientIgnoreUrls: options.clientIgnoreUrls ?? [],
        ignoreErrors: options.ignoreErrors ?? [],
        isAuthorized: options.isAuthorized ?? defaultIsAuthorized,
        getUser: options.getUser,
        // `?? true` rather than a truthiness check: `enableClient: false` is
        // the only value anyone passes, and must survive.
        enableClient: options.enableClient ?? true,
        path: (options.path ?? 'telescope').replace(/^\/+|\/+$/g, ''),
        slowQueryThreshold: options.slowQueryThreshold ?? 100,
        timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    }
}
