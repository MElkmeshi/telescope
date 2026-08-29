import {Request, Response} from "express"
import {IncomingHttpHeaders, OutgoingHttpHeaders} from "http"
import DB from "../DB.js"
import WatcherEntry, {WatcherEntryCollectionType, WatcherEntryDataType} from "../WatcherEntry.js"
import {hostname} from "os"
import JSONFileSyncAdapter from "../drivers/JSONFileSyncAdapter.js"
import {currentBatchId} from "../context.js"
import {ResolvedConfig} from "../config.js"

export const HTTPMethod = {
    GET: "GET",
    HEAD: "HEAD",
    POST: "POST",
    PUT: "PUT",
    PATCH: "PATCH",
    DELETE: "DELETE",
} as const

export type HTTPMethod = typeof HTTPMethod[keyof typeof HTTPMethod]

/**
 * Anonymous traffic has no user, so undefined (or null) is a normal return,
 * not an error — save() already coalesces it away. The type said otherwise,
 * which forced a cast on every honest implementation.
 */
export type GetUserFunction = (request: any) =>
    User | undefined | null | Promise<User | undefined | null>

export interface User
{
    id: string | number
    name?: string
    email?: string
}

export interface RequestWatcherData
{
    hostname: string
    method?: HTTPMethod
    controllerAction?: string
    middleware?: string[]
    uri?: string
    response_status: number
    duration: number
    ip_address?: string
    memory: number
    payload: object
    headers: IncomingHttpHeaders
    response_headers: OutgoingHttpHeaders
    session?: object
    user?: User
    response: any
}

export class RequestWatcherEntry extends WatcherEntry<RequestWatcherData>
{
    constructor(data: RequestWatcherData, batchId?: string)
    {
        super(WatcherEntryDataType.requests, data, batchId)
    }
}

export default class RequestWatcher
{
    public static entryType = WatcherEntryCollectionType.request

    private request: Request
    private response: Response
    public responseBody: any = ''
    private startTime: [number, number]
    private getUser?: GetUserFunction
    private config: ResolvedConfig
    public controllerAction?: string

    constructor(request: Request, response: Response, config: ResolvedConfig)
    {
        this.request = request
        this.response = response
        this.startTime = process.hrtime()
        this.config = config
        this.getUser = config.getUser
    }

    public static capture(request: Request, response: Response, config: ResolvedConfig)
    {
        const watcher = new RequestWatcher(request, response, config)

        if (watcher.shouldIgnore()) {
            return
        }

        watcher.interceptResponse((body: any) =>
        {
            watcher.responseBody = body

            watcher.save()
        })
    }

    private getMemoryUsage(): number
    {
        return Math.round(process.memoryUsage().rss / 1024 / 1024)
    };

    private getDurationInMs(): number
    {
        const stopTime = process.hrtime(this.startTime)

        return Math.round(stopTime[0] * 1000 + stopTime[1] / 1000000)
    }

    private getPayload(): object
    {
        return {
            ...this.request.query,
            ...this.getFilteredBody()
        }
    }

    private interceptResponse(callback: Function): void
    {
        const oldSend = this.response.send

        this.response.send = (content) =>
        {
            const sent = oldSend.call(this.response, content)

            callback(this.formatResponse(content))

            return sent
        }
    }

    private getFilteredBody(): object
    {
        Object.keys(this.request.body ?? {}).map((key) => this.filter(this.request.body, key))

        return this.request.body
    }

    /**
     * Request headers, with credential-bearing ones masked.
     *
     * `authorization` and `cookie` are masked unconditionally, for the same
     * reason `set-cookie` is on the way out: both carry a live credential, and
     * this panel renders what it stores in plain text. A bearer token or
     * session cookie read off the panel can be replayed as that user for the
     * rest of its lifetime, so whoever may VIEW traffic would otherwise also be
     * able to BECOME anyone in it. Everything else is matched against the
     * configured paramsToHide. Node lower-cases incoming header names, so the
     * comparison is lower-cased on both sides.
     *
     * Unlike `response.getHeaders()`, `request.headers` is the live object the
     * application reads — so this copies before masking. Masking in place would
     * blank the Authorization header for any handler that runs after us.
     */
    private getRequestHeaders(): IncomingHttpHeaders
    {
        const hidden = this.config.paramsToHide
            .map((param) => param.toLowerCase())
            .concat('authorization', 'cookie')

        const headers: IncomingHttpHeaders = {...this.request.headers}

        Object.keys(headers).forEach((key) => {
            if (hidden.includes(key.toLowerCase())) {
                headers[key] = '********'
            }
        })

        return headers
    }

    /**
     * Response headers, with credential-bearing ones masked.
     *
     * `set-cookie` is masked unconditionally: it is a session credential by
     * definition, and this panel renders it in plain text. Everything else is
     * matched against the configured paramsToHide. Node lower-cases outgoing
     * header names, so the comparison is lower-cased on both sides.
     */
    private getResponseHeaders(): OutgoingHttpHeaders
    {
        const hidden = this.config.paramsToHide
            .map((param) => param.toLowerCase())
            .concat('set-cookie')

        // getHeaders() already returns a shallow copy, so masking here does not
        // touch the headers actually sent to the client.
        const headers = this.response.getHeaders()

        Object.keys(headers).forEach((key) => {
            if (hidden.includes(key.toLowerCase())) {
                headers[key] = '********'
            }
        })

        return headers
    }

    private filter(params: object, key: string): object
    {
        if (params.hasOwnProperty(key) && this.config.paramsToHide.includes(key)) {
            return Object.assign(params, {[key]: '********'})
        }

        return params
    }

    private contentWithinLimits(content: any): any
    {
        return JSON.stringify(content, JSONFileSyncAdapter.getRefReplacer()).length > (1000 * this.config.responseSizeLimit) ? 'Purged By Telescope' : content
    }

    /**
     * Prepare the response body for storage.
     *
     * res.json() serialises to a string and calls res.send() with it, so what
     * this watcher intercepts is already JSON text. Stored raw, the panel shows
     * one long escaped string instead of a tree. Decoding it here is what
     * Laravel does too (RequestWatcher::response).
     */
    private formatResponse(content: any): any
    {
        const limited = this.contentWithinLimits(content)

        if (limited === 'Purged By Telescope' || typeof limited !== 'string') {
            return limited
        }

        let parsed: any

        try {
            parsed = JSON.parse(limited)
        } catch {
            // Not JSON — HTML, plain text, a redirect notice. Keep it as it is.
            return limited
        }

        // Only objects and arrays. A body of `"5"` or `"true"` is technically
        // valid JSON but reads better as the text that was actually sent.
        if (parsed === null || typeof parsed !== 'object') {
            return limited
        }

        return this.maskDeep(parsed)
    }

    /**
     * Mask configured params anywhere in the decoded body, not just at the top
     * level. Responses nest — a token under `data.session.token` is the same
     * credential as one at the root, and this panel renders it in plain text.
     */
    private maskDeep(value: any, depth = 0): any
    {
        // Bounded so a deep or self-referential structure cannot spin here.
        if (depth > 12 || value === null || typeof value !== 'object') {
            return value
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.maskDeep(item, depth + 1))
        }

        const masked: Record<string, any> = {}

        for (const [key, item] of Object.entries(value)) {
            masked[key] = this.config.paramsToHide.includes(key)
                ? '********'
                : this.maskDeep(item, depth + 1)
        }

        return masked
    }

    /**
     * Tags are what the panel's search box filters on, so they are the answer
     * to "show me this user's requests" and "show me the 500s".
     *
     * `Auth:<id>` is Laravel's own format (IncomingEntry::user). The rest —
     * status, method, path — are the facets worth slicing a request log by.
     */
    private buildTags(user?: User): string[]
    {
        const tags = [
            `status:${this.response.statusCode}`,
            `method:${this.request.method}`,
        ]

        if (this.request.path) {
            tags.push(`path:${this.request.path}`)
        }

        if (user?.id !== undefined && user?.id !== null) {
            tags.push(`Auth:${user.id}`)
        }

        if (user?.email) {
            // Searching by who is far more natural than by an opaque id.
            tags.push(`email:${user.email}`)
        }

        return tags
    }

    public async save()
    {
        // Resolved once: getUser may hit a database, and it is needed both for
        // the entry's content and for its Auth: tag.
        const user = this.getUser ? (await this.getUser(this.request) ?? undefined) : undefined

        const entry = new RequestWatcherEntry({
            hostname: hostname(),
            method: this.request.method as HTTPMethod,
            uri: this.request.path,
            response_status: this.response.statusCode,
            duration: this.getDurationInMs(),
            ip_address: this.request.ip,
            memory: this.getMemoryUsage(),
            payload: this.getPayload(),
            headers: this.getRequestHeaders(),
            response_headers: this.getResponseHeaders(),
            response: this.responseBody,
            user,
            controllerAction: this.controllerAction
        }, currentBatchId())

        entry.tags = this.buildTags(user)

        await DB.requests().save(entry)
    }

    public shouldIgnore(): boolean
    {
        const checks = this.config.ignorePaths.map((path) => {
            return path.endsWith('*') ? this.request.path.startsWith(path.slice(0, -1)) : this.request.path === path
        })

        return checks.includes(true)
    }
}