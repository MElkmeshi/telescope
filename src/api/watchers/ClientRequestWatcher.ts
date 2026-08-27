import axios, {AxiosHeaders, AxiosRequestConfig, AxiosResponse, Method} from 'axios'
import DB from "../DB.js"
import WatcherEntry, {WatcherEntryCollectionType, WatcherEntryDataType} from "../WatcherEntry.js"
import {hostname} from "os"
import Telescope from "../Telescope.js"
import {currentBatchId} from "../context.js"
import {ResolvedConfig} from "../config.js"

export type HeadersType = Record<string, string | number | boolean | string[] | null>

export interface ClientRequestWatcherData
{
    hostname: string
    method: Method | string
    uri: string
    headers: HeadersType
    payload: object
    response_status: number
    response_headers: HeadersType
    response: any
}

export class ClientRequestWatcherEntry extends WatcherEntry<ClientRequestWatcherData>
{
    constructor(data: ClientRequestWatcherData, batchId?: string)
    {
        super(WatcherEntryDataType.clientRequests, data, batchId)
    }
}

export default class ClientRequestWatcher
{
    public static entryType = WatcherEntryCollectionType.clientRequest

    // axios is a process-wide singleton, so the registration must be tracked
    // globally too - otherwise repeated setup() stacks interceptors and stale
    // ones keep recording with their own captured config.
    private static interceptorId?: number

    private request: AxiosRequestConfig
    private response: AxiosResponse
    private config: ResolvedConfig

    constructor(request: AxiosRequestConfig, response: AxiosResponse, config: ResolvedConfig)
    {
        this.request = request
        this.response = response
        this.config = config
    }

    public static capture(telescope: Telescope)
    {
        // axios threads the originating config through to both handlers, so
        // there is no need to stash it between them - a shared slot would
        // mispair concurrent calls.
        if (ClientRequestWatcher.interceptorId !== undefined) {
            axios.interceptors.response.eject(ClientRequestWatcher.interceptorId)
        }

        ClientRequestWatcher.interceptorId = axios.interceptors.response.use(async (response) => {
            const watcher = new ClientRequestWatcher(response.config, response, telescope.config)

            !watcher.shouldIgnore() && await watcher.save()

            return response
        }, async (error: any) => {
            if (error.config && error.response) {
                const watcher = new ClientRequestWatcher(error.config, error.response, telescope.config)

                !watcher.shouldIgnore() && await watcher.save()
            }

            return Promise.reject(error)
        })
    }

    public async save()
    {
        const entry = new ClientRequestWatcherEntry({
            hostname: hostname(),
            method: this.request.method?.toUpperCase() ?? '',
            uri: this.request.url ?? '',
            headers: ClientRequestWatcher.normalizeHeaders(this.request.headers),
            payload: this.request.data ?? {},
            response_status: this.response.status,
            response_headers: ClientRequestWatcher.normalizeHeaders(this.response.headers),
            response: this.isHtmlResponse() ? this.escapeHTML(this.response.data) : this.response.data
        }, currentBatchId())

        await DB.clientRequests().save(entry)
    }

    private static normalizeHeaders(headers?: unknown): HeadersType
    {
        if (!headers) {
            return {}
        }

        // axios >=1 wraps headers in an AxiosHeaders instance, which does not
        // survive being persisted as-is.
        return headers instanceof AxiosHeaders
            ? headers.toJSON() as HeadersType
            : {...headers as HeadersType}
    }

    private escapeHTML(html: string)
    {
        return html.replace(
            /[&<>'"]/g,
            tag =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    "'": '&#39;',
                    '"': '&quot;'
                }[tag] || tag)
        )
    }

    private isHtmlResponse(): boolean
    {
        const contentType = this.response?.headers?.['content-type']

        return typeof contentType === 'string' && contentType.startsWith('text/html')
    }

    private shouldIgnore(): boolean
    {
        const checks = this.config.clientIgnoreUrls.map((url) => {
            return url.endsWith('*') ? this.request.url?.startsWith(url.slice(0, -1)) : this.request.url === url
        })

        return checks.includes(true)
    }
}