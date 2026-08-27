var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import LowDriver from "./drivers/LowDriver.js";
import { WatcherEntryCollectionType } from "./WatcherEntry.js";
import { shouldRecordCurrentBatch } from "./context.js";
class DB {
    constructor() {
        DB.db = new DB.driver(DB.options);
    }
    /**
     * A driver may be given as a class or as an already-built instance.
     * Instances exist for drivers that need construction arguments a bare
     * `new Driver()` cannot supply — a connection pool, most obviously.
     */
    static configure(driver, options = {}) {
        DB.options = options;
        if (typeof driver === 'function') {
            DB.driver = driver;
            DB.db = undefined;
            return;
        }
        DB.db = driver;
    }
    /** Applied to every entry before it reaches the driver. */
    static configureFilter(filter) {
        DB.filter = filter;
    }
    /**
     * Sampling is checked here rather than in each watcher so that every
     * collection honours it — a watcher added later cannot forget to.
     */
    static shouldStore(entry) {
        if (!shouldRecordCurrentBatch()) {
            return false;
        }
        return DB.filter ? DB.filter(entry) : true;
    }
    static prune(before) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield DB.get();
            return db.prune ? db.prune(before) : 0;
        });
    }
    static entry(name) {
        return {
            get: (take) => __awaiter(this, void 0, void 0, function* () { return (yield DB.get()).get(name, take); }),
            find: (id) => __awaiter(this, void 0, void 0, function* () { return (yield DB.get()).find(name, id); }),
            save: (data) => __awaiter(this, void 0, void 0, function* () {
                if (!DB.shouldStore(data)) {
                    return;
                }
                return (yield DB.get()).save(name, data);
            }),
            update: (index, toUpdate) => __awaiter(this, void 0, void 0, function* () { return (yield DB.get()).update(name, index, toUpdate); }),
        };
    }
    static batch(batchId) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield DB.get()).batch(batchId);
        });
    }
    static truncate() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield DB.get()).truncate();
        });
    }
    static requests() {
        return this.entry(WatcherEntryCollectionType.request);
    }
    static errors() {
        return this.entry(WatcherEntryCollectionType.exception);
    }
    static dumps() {
        return this.entry(WatcherEntryCollectionType.dump);
    }
    static logs() {
        return this.entry(WatcherEntryCollectionType.log);
    }
    static queries() {
        return this.entry(WatcherEntryCollectionType.query);
    }
    static clientRequests() {
        return this.entry(WatcherEntryCollectionType.clientRequest);
    }
    static get() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!DB.db) {
                new DB();
            }
            return DB.db;
        });
    }
}
DB.driver = LowDriver;
DB.options = {};
export default DB;
