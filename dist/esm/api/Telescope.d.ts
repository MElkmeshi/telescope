import { Express, Router } from 'express';
import ClientRequestWatcher from "./watchers/ClientRequestWatcher.js";
import LogWatcher from "./watchers/LogWatcher.js";
import RequestWatcher from "./watchers/RequestWatcher.js";
import ErrorWatcher from "./watchers/ErrorWatcher.js";
import DumpWatcher from "./watchers/DumpWatcher.js";
import QueryWatcher from "./watchers/QueryWatcher.js";
import { ResolvedConfig, TelescopeOptions } from "./config.js";
export type { TelescopeOptions, ResolvedConfig } from "./config.js";
export type Watcher = typeof RequestWatcher | typeof ErrorWatcher | typeof ClientRequestWatcher | typeof DumpWatcher | typeof LogWatcher | typeof QueryWatcher;
export default class Telescope {
    app: Express;
    readonly config: ResolvedConfig;
    readonly enabledWatchers: Watcher[];
    recording: boolean;
    private pruneTimer?;
    constructor(app: Express, options?: TelescopeOptions);
    static setup(app: Express, options?: TelescopeOptions): Telescope;
    /** Sampling decision for one batch. */
    private rollSample;
    /**
     * Delete everything older than the retention window. Safe to call by hand
     * — from a cron, a shutdown hook, or a test.
     */
    prune(): Promise<number>;
    /**
     * Start the background sweeper. The timer is unref'd so it never holds the
     * process open — a debug tool should not be the reason a container refuses
     * to exit — and it is idempotent, so repeated setup() calls in tests do not
     * stack timers.
     */
    startPruning(): void;
    stopPruning(): void;
    isEnabled(watcher: Watcher): boolean;
    getEnabledWatchers(): string[];
    /**
     * Returns a Router for the caller to mount wherever they like. Mount it at
     * the same prefix given as `path` so the client's generated links resolve.
     */
    router(): Router;
}
