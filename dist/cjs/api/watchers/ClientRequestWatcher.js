"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientRequestWatcherEntry = void 0;
const axios_1 = __importStar(require("axios"));
const DB_js_1 = __importDefault(require("../DB.js"));
const WatcherEntry_js_1 = __importStar(require("../WatcherEntry.js"));
const os_1 = require("os");
class ClientRequestWatcherEntry extends WatcherEntry_js_1.default {
    constructor(data, batchId) {
        super(WatcherEntry_js_1.WatcherEntryDataType.clientRequests, data, batchId);
    }
}
exports.ClientRequestWatcherEntry = ClientRequestWatcherEntry;
class ClientRequestWatcher {
    constructor(request, response, batchId) {
        this.batchId = batchId;
        this.request = request;
        this.response = response;
    }
    static capture(telescope) {
        let request = null;
        axios_1.default.interceptors.request.use((config) => {
            request = config;
            return config;
        });
        axios_1.default.interceptors.response.use((response) => __awaiter(this, void 0, void 0, function* () {
            if (request) {
                const watcher = new ClientRequestWatcher(request, response, telescope.batchId);
                !watcher.shouldIgnore() && (yield watcher.save());
                request = null;
            }
            return response;
        }), (error) => __awaiter(this, void 0, void 0, function* () {
            if (request) {
                const watcher = new ClientRequestWatcher(request, error.response, telescope.batchId);
                !watcher.shouldIgnore() && (yield watcher.save());
                request = null;
            }
            return Promise.reject(error);
        }));
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const entry = new ClientRequestWatcherEntry({
                hostname: (0, os_1.hostname)(),
                method: (_b = (_a = this.request.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) !== null && _b !== void 0 ? _b : '',
                uri: (_c = this.request.url) !== null && _c !== void 0 ? _c : '',
                headers: ClientRequestWatcher.normalizeHeaders(this.request.headers),
                payload: (_d = this.request.data) !== null && _d !== void 0 ? _d : {},
                response_status: this.response.status,
                response_headers: ClientRequestWatcher.normalizeHeaders(this.response.headers),
                response: this.isHtmlResponse() ? this.escapeHTML(this.response.data) : this.response.data
            }, this.batchId);
            yield DB_js_1.default.clientRequests().save(entry);
        });
    }
    static normalizeHeaders(headers) {
        if (!headers) {
            return {};
        }
        // axios >=1 wraps headers in an AxiosHeaders instance, which does not
        // survive being persisted as-is.
        return headers instanceof axios_1.AxiosHeaders
            ? headers.toJSON()
            : Object.assign({}, headers);
    }
    escapeHTML(html) {
        return html.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag));
    }
    isHtmlResponse() {
        var _a, _b;
        const contentType = (_b = (_a = this.response) === null || _a === void 0 ? void 0 : _a.headers) === null || _b === void 0 ? void 0 : _b['content-type'];
        return typeof contentType === 'string' && contentType.startsWith('text/html');
    }
    shouldIgnore() {
        const checks = ClientRequestWatcher.ignoreUrls.map((url) => {
            var _a;
            return url.endsWith('*') ? (_a = this.request.url) === null || _a === void 0 ? void 0 : _a.startsWith(url.slice(0, -1)) : this.request.url === url;
        });
        return checks.includes(true);
    }
}
ClientRequestWatcher.entryType = WatcherEntry_js_1.WatcherEntryCollectionType.clientRequest;
ClientRequestWatcher.ignoreUrls = [];
exports.default = ClientRequestWatcher;
