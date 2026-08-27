var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express, { Router } from 'express';
import DB from './DB.js';
import ClientRequestWatcher from "./watchers/ClientRequestWatcher.js";
import LogWatcher from "./watchers/LogWatcher.js";
import RequestWatcher from "./watchers/RequestWatcher.js";
import { randomUUID } from "node:crypto";
import { runWithContext } from "./context.js";
import ErrorWatcher from "./watchers/ErrorWatcher.js";
import DumpWatcher from "./watchers/DumpWatcher.js";
import { resolveConfig } from "./config.js";
import { readIndex, resolveClientDir } from "./client.js";
import { join } from "node:path";
const DEFAULT_WATCHERS = [
    RequestWatcher,
    ErrorWatcher,
    ClientRequestWatcher,
    DumpWatcher,
    LogWatcher
];
export default class Telescope {
    constructor(app, options) {
        var _a;
        this.recording = true;
        this.app = app;
        this.config = resolveConfig(options);
        this.enabledWatchers = (_a = options === null || options === void 0 ? void 0 : options.enabledWatchers) !== null && _a !== void 0 ? _a : DEFAULT_WATCHERS;
        if (options === null || options === void 0 ? void 0 : options.databaseDriver) {
            DB.configure(options.databaseDriver);
        }
    }
    static setup(app, options) {
        const telescope = new Telescope(app, options);
        app.use((request, response, next) => {
            if (!telescope.recording) {
                next();
                return;
            }
            runWithContext({ batchId: randomUUID() }, () => {
                telescope.isEnabled(RequestWatcher)
                    && RequestWatcher.capture(request, response, telescope.config);
                next();
            });
        });
        telescope.isEnabled(ClientRequestWatcher)
            && ClientRequestWatcher.capture(telescope);
        telescope.isEnabled(LogWatcher)
            && LogWatcher.capture(telescope);
        return telescope;
    }
    isEnabled(watcher) {
        return this.enabledWatchers.includes(watcher);
    }
    getEnabledWatchers() {
        return this.enabledWatchers.map((watcher) => watcher.entryType);
    }
    /**
     * Returns a Router for the caller to mount wherever they like. Mount it at
     * the same prefix given as `path` so the client's generated links resolve.
     */
    router() {
        const router = Router();
        if (!this.config.enableClient) {
            return router;
        }
        router.use(this.config.isAuthorized);
        router.post('/telescope-api/toggle-recording', (request, response) => {
            this.recording = !this.recording;
            response.json({ recording: this.recording });
        });
        router.post('/telescope-api/:entry', (request, response) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const entries = yield DB.entry(request.params.entry).get(Number((_a = request.query.take) !== null && _a !== void 0 ? _a : 50));
            response.json({
                entries,
                status: "enabled"
            });
        }));
        router.get('/telescope-api/entries', (request, response) => __awaiter(this, void 0, void 0, function* () {
            response.json({
                enabled: this.getEnabledWatchers()
            });
        }));
        router.delete('/telescope-api/entries', (request, response) => __awaiter(this, void 0, void 0, function* () {
            yield DB.truncate();
            response.send("OK");
        }));
        router.get('/telescope-api/:entry/:id', (request, response) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const entry = yield DB.entry(request.params.entry).find(request.params.id);
            response.json({
                entry,
                batch: yield DB.batch((_a = entry === null || entry === void 0 ? void 0 : entry.batchId) !== null && _a !== void 0 ? _a : '')
            });
        }));
        const dir = resolveClientDir();
        router.use('/app.js', express.static(join(dir, 'app.js')));
        router.use('/app.css', express.static(join(dir, 'app.css')));
        router.use('/app-dark.css', express.static(join(dir, 'app-dark.css')));
        router.use('/favicon.ico', express.static(join(dir, 'favicon.ico')));
        const serveIndex = (request, response) => response.type('html').send(readIndex(this.config, this.recording));
        this.getEnabledWatchers().forEach((watcher) => {
            router.get(`/${watcher}`, serveIndex);
            router.get(`/${watcher}/:id`, serveIndex);
        });
        router.get('/', (request, response) => response.redirect(`/${this.config.path}/requests`));
        return router;
    }
}
