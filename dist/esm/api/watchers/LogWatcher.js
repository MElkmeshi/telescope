import DB from "../DB.js";
import WatcherEntry, { WatcherEntryCollectionType, WatcherEntryDataType } from "../WatcherEntry.js";
import { hostname } from "os";
import JSONFileSyncAdapter from "../drivers/JSONFileSyncAdapter.js";
import { currentBatchId } from "../context.js";
export const LogLevel = {
    INFO: "info",
    WARNING: "warning",
    ERROR: "error",
};
export class LogWatcherEntry extends WatcherEntry {
    constructor(data, batchId) {
        super(WatcherEntryDataType.logs, data, batchId);
    }
}
class LogWatcher {
    constructor(data, level) {
        this.data = {
            hostname: hostname(),
            level,
            message: this.getMessage(data),
            context: data,
        };
    }
    static capture(telescope) {
        var _a, _b;
        const oldLog = (_a = LogWatcher.originalLog) !== null && _a !== void 0 ? _a : (LogWatcher.originalLog = console.log);
        console.log = (...data) => {
            oldLog(...data);
            if (typeof data[0] == 'string') {
                data[0] = data[0].split('[32m').join('');
                data[0] = data[0].split('[39m').join('');
            }
            const watcher = new LogWatcher(data, LogLevel.INFO);
            watcher.save();
        };
        const oldWarn = (_b = LogWatcher.originalWarn) !== null && _b !== void 0 ? _b : (LogWatcher.originalWarn = console.warn);
        console.warn = (...data) => {
            oldWarn(...data);
            const watcher = new LogWatcher(data, LogLevel.WARNING);
            watcher.save();
        };
        /* console.error handles ErrorWatcher
        const oldError = console.error

        console.error = (...data: any[]) => {
            oldError(...data)

            const watcher = new LogWatcher(data, LogLevel.ERROR)

            watcher.save()
        }
        */
    }
    save() {
        const entry = new LogWatcherEntry(this.data, currentBatchId());
        DB.logs().save(entry);
    }
    getMessage(data) {
        let message = data.shift();
        if (typeof message !== 'string') {
            message = JSON.stringify(message, JSONFileSyncAdapter.getRefReplacer());
        }
        return message;
    }
}
LogWatcher.entryType = WatcherEntryCollectionType.log;
export default LogWatcher;
