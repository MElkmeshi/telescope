import { Request, Response } from "express";
import { IncomingHttpHeaders, OutgoingHttpHeaders } from "http";
import WatcherEntry from "../WatcherEntry.js";
import { ResolvedConfig } from "../config.js";
export declare const HTTPMethod: {
    readonly GET: "GET";
    readonly HEAD: "HEAD";
    readonly POST: "POST";
    readonly PUT: "PUT";
    readonly PATCH: "PATCH";
    readonly DELETE: "DELETE";
};
export type HTTPMethod = typeof HTTPMethod[keyof typeof HTTPMethod];
/**
 * Anonymous traffic has no user, so undefined (or null) is a normal return,
 * not an error — save() already coalesces it away. The type said otherwise,
 * which forced a cast on every honest implementation.
 */
export type GetUserFunction = (request: any) => User | undefined | null | Promise<User | undefined | null>;
export interface User {
    id: string | number;
    name?: string;
    email?: string;
}
export interface RequestWatcherData {
    hostname: string;
    method?: HTTPMethod;
    controllerAction?: string;
    middleware?: string[];
    uri?: string;
    response_status: number;
    duration: number;
    ip_address?: string;
    memory: number;
    payload: object;
    headers: IncomingHttpHeaders;
    response_headers: OutgoingHttpHeaders;
    session?: object;
    user?: User;
    response: any;
}
export declare class RequestWatcherEntry extends WatcherEntry<RequestWatcherData> {
    constructor(data: RequestWatcherData, batchId?: string);
}
export default class RequestWatcher {
    static entryType: "requests";
    private request;
    private response;
    responseBody: any;
    private startTime;
    private getUser?;
    private config;
    controllerAction?: string;
    constructor(request: Request, response: Response, config: ResolvedConfig);
    static capture(request: Request, response: Response, config: ResolvedConfig): void;
    private getMemoryUsage;
    private getDurationInMs;
    private getPayload;
    private interceptResponse;
    private getFilteredBody;
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
    private getRequestHeaders;
    /**
     * Response headers, with credential-bearing ones masked.
     *
     * `set-cookie` is masked unconditionally: it is a session credential by
     * definition, and this panel renders it in plain text. Everything else is
     * matched against the configured paramsToHide. Node lower-cases outgoing
     * header names, so the comparison is lower-cased on both sides.
     */
    private getResponseHeaders;
    private filter;
    private contentWithinLimits;
    /**
     * Prepare the response body for storage.
     *
     * res.json() serialises to a string and calls res.send() with it, so what
     * this watcher intercepts is already JSON text. Stored raw, the panel shows
     * one long escaped string instead of a tree. Decoding it here is what
     * Laravel does too (RequestWatcher::response).
     */
    private formatResponse;
    /**
     * Mask configured params anywhere in the decoded body, not just at the top
     * level. Responses nest — a token under `data.session.token` is the same
     * credential as one at the root, and this panel renders it in plain text.
     */
    private maskDeep;
    /**
     * Tags are what the panel's search box filters on, so they are the answer
     * to "show me this user's requests" and "show me the 500s".
     *
     * `Auth:<id>` is Laravel's own format (IncomingEntry::user). The rest —
     * status, method, path — are the facets worth slicing a request log by.
     */
    private buildTags;
    save(): Promise<void>;
    shouldIgnore(): boolean;
}
