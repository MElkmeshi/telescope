import axios, {AxiosHeaders, AxiosRequestConfig, AxiosResponse, Method} from 'axios'
import DB from "../DB.js"
import WatcherEntry, {WatcherEntryCollectionType, WatcherEntryDataType} from "../WatcherEntry.js"
import {hostname} from "os"
import Telescope from "../Telescope.js"

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
    public static ignoreUrls: string[] = []

    private batchId?: string
    private request: AxiosRequestConfig
    private response: AxiosResponse

    constructor(request: AxiosRequestConfig, response: AxiosResponse, batchId?: string)
    {
        this.batchId = batchId
        this.request = request
        this.response = response
    }

    public static capture(telescope: Telescope)
    {
        let request: AxiosRequestConfig | null = null

        axios.interceptors.request.use((config) => {
            request = config

            return config
        })

        axios.interceptors.response.use(async (response) => {
            if (request) {
                const watcher = new ClientRequestWatcher(request, response, telescope.batchId)

                !watcher.shouldIgnore() && await watcher.save()

                request = null
            }

            return response
        }, async (error: any) => {
            if (request) {
                const watcher = new ClientRequestWatcher(request, error.response, telescope.batchId)

                !watcher.shouldIgnore() && await watcher.save()

                request = null
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
        }, this.batchId)

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
        const checks = ClientRequestWatcher.ignoreUrls.map((url) => {
            return url.endsWith('*') ? this.request.url?.startsWith(url.slice(0, -1)) : this.request.url === url
        })

        return checks.includes(true)
    }
}