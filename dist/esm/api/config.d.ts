import { NextFunction, Request, Response } from "express";
import { Driver } from "./DB.js";
import DatabaseDriver from "./drivers/DatabaseDriver.js";
import { GetUserFunction } from "./watchers/RequestWatcher.js";
import WatcherEntry from "./WatcherEntry.js";
export interface TelescopeOptions {
    enabledWatchers?: any[];
    databaseDriver?: Driver | DatabaseDriver;
    responseSizeLimit?: number;
    paramsToHide?: string[];
    ignorePaths?: string[];
    clientIgnoreUrls?: string[];
    ignoreErrors?: ErrorConstructor[];
    isAuthorized?: (request: Request, response: Response, next: NextFunction) => void;
    getUser?: GetUserFunction;
    enableClient?: boolean;
    path?: string;
    slowQueryThreshold?: number;
    timezone?: string;
    /**
     * How long entries are kept. Entries older than this are deleted by the
     * background sweeper. Laravel's equivalent is `telescope:prune --hours`.
     * Set to 0 to keep everything, which is only sane for short-lived
     * processes — nothing else reclaims the space.
     */
    retentionHours?: number;
    /**
     * Hard ceiling on stored entries per collection, enforced on write.
     *
     * Retention alone cannot bound memory: a burst can store a million entries
     * inside one retention window. This is the backstop that keeps a long-lived
     * process from growing without limit between sweeps. 0 disables it.
     */
    maxEntries?: number;
    /** How often the sweeper runs. Defaults to every 10 minutes. */
    pruneIntervalMs?: number;
    /**
     * Fraction of requests to record, 0..1. Applied once per batch, so a
     * recorded request keeps all of its queries and logs. Entries raised
     * outside a request are always recorded.
     */
    sampleRate?: number;
    /**
     * Last word on whether an entry is stored. Runs per entry, after sampling.
     * Laravel's `Telescope::filter()`. Returning false drops that entry only.
     */
    filter?: (entry: WatcherEntry<any>) => boolean;
}
export interface ResolvedConfig {
    databaseDriver: Driver | DatabaseDriver;
    responseSizeLimit: number;
    paramsToHide: string[];
    ignorePaths: string[];
    clientIgnoreUrls: string[];
    ignoreErrors: ErrorConstructor[];
    isAuthorized: (request: Request, response: Response, next: NextFunction) => void;
    getUser?: GetUserFunction;
    enableClient: boolean;
    path: string;
    slowQueryThreshold: number;
    timezone: string;
    retentionHours: number;
    maxEntries: number;
    pruneIntervalMs: number;
    sampleRate: number;
    filter?: (entry: WatcherEntry<any>) => boolean;
}
export declare function resolveConfig(options?: TelescopeOptions): ResolvedConfig;
