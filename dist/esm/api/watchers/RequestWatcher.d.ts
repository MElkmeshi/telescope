import { Request, Response } from "express";
import { IncomingHttpHeaders } from "http";
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
export type GetUserFunction = (request: any) => User | Promise<User>;
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
    private filter;
    private contentWithinLimits;
    save(): Promise<void>;
    shouldIgnore(): boolean;
}
