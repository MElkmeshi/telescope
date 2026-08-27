var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import DB from "../DB.js";
import WatcherEntry, { WatcherEntryCollectionType, WatcherEntryDataType } from "../WatcherEntry.js";
import { hostname } from "os";
import JSONFileSyncAdapter from "../drivers/JSONFileSyncAdapter.js";
import { currentBatchId } from "../context.js";
export const HTTPMethod = {
    GET: "GET",
    HEAD: "HEAD",
    POST: "POST",
    PUT: "PUT",
    PATCH: "PATCH",
    DELETE: "DELETE",
};
export class RequestWatcherEntry extends WatcherEntry {
    constructor(data, batchId) {
        super(WatcherEntryDataType.requests, data, batchId);
    }
}
class RequestWatcher {
    constructor(request, response, config) {
        this.responseBody = '';
        this.request = request;
        this.response = response;
        this.startTime = process.hrtime();
        this.config = config;
        this.getUser = config.getUser;
    }
    static capture(request, response, config) {
        const watcher = new RequestWatcher(request, response, config);
        if (watcher.shouldIgnore()) {
            return;
        }
        watcher.interceptResponse((body) => {
            watcher.responseBody = body;
            watcher.save();
        });
    }
    getMemoryUsage() {
        return Math.round(process.memoryUsage().rss / 1024 / 1024);
    }
    ;
    getDurationInMs() {
        const stopTime = process.hrtime(this.startTime);
        return Math.round(stopTime[0] * 1000 + stopTime[1] / 1000000);
    }
    getPayload() {
        return Object.assign(Object.assign({}, this.request.query), this.getFilteredBody());
    }
    interceptResponse(callback) {
        const oldSend = this.response.send;
        this.response.send = (content) => {
            const sent = oldSend.call(this.response, content);
            callback(this.formatResponse(content));
            return sent;
        };
    }
    getFilteredBody() {
        var _a;
        Object.keys((_a = this.request.body) !== null && _a !== void 0 ? _a : {}).map((key) => this.filter(this.request.body, key));
        return this.request.body;
    }
    /**
     * Response headers, with credential-bearing ones masked.
     *
     * `set-cookie` is masked unconditionally: it is a session credential by
     * definition, and this panel renders it in plain text. Everything else is
     * matched against the configured paramsToHide. Node lower-cases outgoing
     * header names, so the comparison is lower-cased on both sides.
     */
    getResponseHeaders() {
        const hidden = this.config.paramsToHide
            .map((param) => param.toLowerCase())
            .concat('set-cookie');
        // getHeaders() already returns a shallow copy, so masking here does not
        // touch the headers actually sent to the client.
        const headers = this.response.getHeaders();
        Object.keys(headers).forEach((key) => {
            if (hidden.includes(key.toLowerCase())) {
                headers[key] = '********';
            }
        });
        return headers;
    }
    filter(params, key) {
        if (params.hasOwnProperty(key) && this.config.paramsToHide.includes(key)) {
            return Object.assign(params, { [key]: '********' });
        }
        return params;
    }
    contentWithinLimits(content) {
        return JSON.stringify(content, JSONFileSyncAdapter.getRefReplacer()).length > (1000 * this.config.responseSizeLimit) ? 'Purged By Telescope' : content;
    }
    /**
     * Prepare the response body for storage.
     *
     * res.json() serialises to a string and calls res.send() with it, so what
     * this watcher intercepts is already JSON text. Stored raw, the panel shows
     * one long escaped string instead of a tree. Decoding it here is what
     * Laravel does too (RequestWatcher::response).
     */
    formatResponse(content) {
        const limited = this.contentWithinLimits(content);
        if (limited === 'Purged By Telescope' || typeof limited !== 'string') {
            return limited;
        }
        let parsed;
        try {
            parsed = JSON.parse(limited);
        }
        catch (_a) {
            // Not JSON — HTML, plain text, a redirect notice. Keep it as it is.
            return limited;
        }
        // Only objects and arrays. A body of `"5"` or `"true"` is technically
        // valid JSON but reads better as the text that was actually sent.
        if (parsed === null || typeof parsed !== 'object') {
            return limited;
        }
        return this.maskDeep(parsed);
    }
    /**
     * Mask configured params anywhere in the decoded body, not just at the top
     * level. Responses nest — a token under `data.session.token` is the same
     * credential as one at the root, and this panel renders it in plain text.
     */
    maskDeep(value, depth = 0) {
        // Bounded so a deep or self-referential structure cannot spin here.
        if (depth > 12 || value === null || typeof value !== 'object') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.maskDeep(item, depth + 1));
        }
        const masked = {};
        for (const [key, item] of Object.entries(value)) {
            masked[key] = this.config.paramsToHide.includes(key)
                ? '********'
                : this.maskDeep(item, depth + 1);
        }
        return masked;
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const entry = new RequestWatcherEntry({
                hostname: hostname(),
                method: this.request.method,
                uri: this.request.path,
                response_status: this.response.statusCode,
                duration: this.getDurationInMs(),
                ip_address: this.request.ip,
                memory: this.getMemoryUsage(),
                payload: this.getPayload(),
                headers: this.request.headers,
                response_headers: this.getResponseHeaders(),
                response: this.responseBody,
                user: this.getUser ? ((_a = yield this.getUser(this.request)) !== null && _a !== void 0 ? _a : undefined) : undefined,
                controllerAction: this.controllerAction
            }, currentBatchId());
            yield DB.requests().save(entry);
        });
    }
    shouldIgnore() {
        const checks = this.config.ignorePaths.map((path) => {
            return path.endsWith('*') ? this.request.path.startsWith(path.slice(0, -1)) : this.request.path === path;
        });
        return checks.includes(true);
    }
}
RequestWatcher.entryType = WatcherEntryCollectionType.request;
export default RequestWatcher;
