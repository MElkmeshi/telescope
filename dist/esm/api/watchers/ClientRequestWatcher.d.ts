import { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import WatcherEntry from "../WatcherEntry.js";
import Telescope from "../Telescope.js";
import { ResolvedConfig } from "../config.js";
export type HeadersType = Record<string, string | number | boolean | string[] | null>;
export interface ClientRequestWatcherData {
    hostname: string;
    method: Method | string;
    uri: string;
    headers: HeadersType;
    payload: object;
    response_status: number;
    response_headers: HeadersType;
    response: any;
}
export declare class ClientRequestWatcherEntry extends WatcherEntry<ClientRequestWatcherData> {
    constructor(data: ClientRequestWatcherData, batchId?: string);
}
export default class ClientRequestWatcher {
    static entryType: "client-requests";
    private static interceptorId?;
    private request;
    private response;
    private config;
    constructor(request: AxiosRequestConfig, response: AxiosResponse, config: ResolvedConfig);
    static capture(telescope: Telescope): void;
    save(): Promise<void>;
    private static normalizeHeaders;
    private escapeHTML;
    private isHtmlResponse;
    private shouldIgnore;
}
