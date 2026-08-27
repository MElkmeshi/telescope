import { Express, Router } from 'express';
import ClientRequestWatcher from "./watchers/ClientRequestWatcher.js";
import LogWatcher from "./watchers/LogWatcher.js";
import RequestWatcher from "./watchers/RequestWatcher.js";
import ErrorWatcher from "./watchers/ErrorWatcher.js";
import DumpWatcher from "./watchers/DumpWatcher.js";
import { ResolvedConfig, TelescopeOptions } from "./config.js";
export type { TelescopeOptions, ResolvedConfig } from "./config.js";
export type Watcher = typeof RequestWatcher | typeof ErrorWatcher | typeof ClientRequestWatcher | typeof DumpWatcher | typeof LogWatcher;
export default class Telescope {
    app: Express;
    readonly config: ResolvedConfig;
    readonly enabledWatchers: Watcher[];
    recording: boolean;
    constructor(app: Express, options?: TelescopeOptions);
    static setup(app: Express, options?: TelescopeOptions): Telescope;
    isEnabled(watcher: Watcher): boolean;
    getEnabledWatchers(): string[];
    /**
     * Returns a Router for the caller to mount wherever they like. Mount it at
     * the same prefix given as `path` so the client's generated links resolve.
     */
    router(): Router;
}
