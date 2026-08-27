var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from 'express';
import DB from './DB.js';
import ClientRequestWatcher from "./watchers/ClientRequestWatcher.js";
import LogWatcher from "./watchers/LogWatcher.js";
import RequestWatcher from "./watchers/RequestWatcher.js";
import { randomUUID } from "node:crypto";
import { runWithContext } from "./context.js";
import ErrorWatcher from "./watchers/ErrorWatcher.js";
import DumpWatcher from "./watchers/DumpWatcher.js";
import { resolveConfig } from "./config.js";
import { existsSync } from "node:fs";
import path from "node:path";
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
        if (telescope.config.enableClient) {
            app.use(`/${telescope.config.path}`, telescope.config.isAuthorized);
            telescope.setUpApi();
            telescope.setUpStaticFiles();
        }
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
    setUpApi() {
        const prefix = `/${this.config.path}`;
        this.app.post(`${prefix}/telescope-api/:entry`, (request, response) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const entries = yield DB.entry(request.params.entry).get(Number((_a = request.query.take) !== null && _a !== void 0 ? _a : 50));
            response.json({
                entries,
                status: "enabled"
            });
        }));
        this.app.get(`${prefix}/telescope-api/:entry/:id`, (request, response) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const entry = yield DB.entry(request.params.entry).find(request.params.id);
            response.json({
                entry,
                batch: yield DB.batch((_a = entry === null || entry === void 0 ? void 0 : entry.batchId) !== null && _a !== void 0 ? _a : '')
            });
        }));
        this.app.delete(`${prefix}/telescope-api/entries`, (request, response) => __awaiter(this, void 0, void 0, function* () {
            yield DB.truncate();
            response.send("OK");
        }));
        this.app.get(`${prefix}/telescope-api/entries`, (request, response) => __awaiter(this, void 0, void 0, function* () {
            response.json({
                enabled: this.getEnabledWatchers()
            });
        }));
    }
    resolveDir() {
        let dir = process.cwd() + '/node_modules/@damianchojnacki/telescope/dist/';
        if (!existsSync(dir + 'index.html')) {
            dir = path.join(process.cwd(), '/dist/');
        }
        return dir;
    }
    setUpStaticFiles() {
        const dir = this.resolveDir();
        const prefix = `/${this.config.path}`;
        this.app.use(`${prefix}/app.js`, express.static(dir + "app.js"));
        this.app.use(`${prefix}/app.css`, express.static(dir + "app.css"));
        this.app.use(`${prefix}/app-dark.css`, express.static(dir + "app-dark.css"));
        this.app.use(`${prefix}/favicon.ico`, express.static(dir + "favicon.ico"));
        this.getEnabledWatchers().forEach((watcher) => {
            this.app.use(`${prefix}/${watcher}`, express.static(dir + 'index.html'));
            this.app.use(`${prefix}/${watcher}/:id`, express.static(dir + 'index.html'));
        });
        this.app.get(`${prefix}/`, (request, response) => response.redirect(`${prefix}/requests`));
    }
}
