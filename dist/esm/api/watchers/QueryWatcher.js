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
import { currentBatchId } from "../context.js";
export class QueryWatcherEntry extends WatcherEntry {
    constructor(data, batchId) {
        super(WatcherEntryDataType.queries, data, batchId);
    }
}
class QueryWatcher {
    static record(query, config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const entry = new QueryWatcherEntry({
                sql: query.sql,
                bindings: (_a = query.bindings) !== null && _a !== void 0 ? _a : [],
                time: query.time,
                slow: query.time >= config.slowQueryThreshold,
                connection: (_b = query.connection) !== null && _b !== void 0 ? _b : 'default',
            }, currentBatchId());
            yield DB.queries().save(entry);
        });
    }
}
QueryWatcher.entryType = WatcherEntryCollectionType.query;
export default QueryWatcher;
