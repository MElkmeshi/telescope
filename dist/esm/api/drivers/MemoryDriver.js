var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function emptyDb() {
    return {
        requests: [],
        exceptions: [],
        dumps: [],
        logs: [],
        queries: [],
        "client-requests": [],
    };
}
export default class MemoryDriver {
    constructor(options = {}) {
        var _a;
        this.db = emptyDb();
        this.maxEntries = (_a = options.maxEntries) !== null && _a !== void 0 ? _a : 0;
    }
    get(name, take) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const entries = (_a = this.db[name]) !== null && _a !== void 0 ? _a : [];
            // Honouring `take` matters more here than for a file-backed driver:
            // this list is the whole recorded history, and the client asks for a
            // page of 50. Returning all of it serialised the entire buffer on
            // every poll.
            return take ? entries.slice(0, take) : entries;
        });
    }
    find(name, id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            return (_a = this.db[name]) === null || _a === void 0 ? void 0 : _a.find((entry) => entry.id === id);
        });
    }
    batch(batchId) {
        return __awaiter(this, void 0, void 0, function* () {
            const batch = [];
            Object.keys(this.db).forEach((key) => {
                // @ts-ignore
                batch.push(this.db[key]);
            });
            return batch.flat().filter((entry) => entry.batchId === batchId);
        });
    }
    save(name, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            (_a = this.db[name]) === null || _a === void 0 ? void 0 : _a.unshift(data);
            this.enforceLimit(name);
        });
    }
    update(name, index, toUpdate) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.db[name].splice(index, 1);
            (_a = this.db[name]) === null || _a === void 0 ? void 0 : _a.unshift(toUpdate);
        });
    }
    prune(before) {
        return __awaiter(this, void 0, void 0, function* () {
            const cutoff = before.getTime();
            let pruned = 0;
            for (const key of Object.keys(this.db)) {
                const kept = this.db[key].filter((entry) => new Date(entry.created_at).getTime() >= cutoff);
                pruned += this.db[key].length - kept.length;
                // @ts-ignore — key indexes a union of entry array types
                this.db[key] = kept;
            }
            return pruned;
        });
    }
    truncate() {
        return __awaiter(this, void 0, void 0, function* () {
            this.db = emptyDb();
        });
    }
    /**
     * Entries are unshifted, so the newest are at the front and the tail is
     * what to drop.
     */
    enforceLimit(name) {
        if (this.maxEntries > 0 && this.db[name].length > this.maxEntries) {
            this.db[name].length = this.maxEntries;
        }
    }
}
