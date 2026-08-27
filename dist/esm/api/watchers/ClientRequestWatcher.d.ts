import { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import WatcherEntry from "../WatcherEntry.js";
import Telescope from "../Telescope.js";
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
    static ignoreUrls: string[];
    private batchId?;
    private request;
    private response;
    constructor(request: AxiosRequestConfig, response: AxiosResponse, batchId?: string);
    static capture(telescope: Telescope): void;
    save(): Promise<void>;
    private static normalizeHeaders;
    private escapeHTML;
    private isHtmlResponse;
    private shouldIgnore;
}
