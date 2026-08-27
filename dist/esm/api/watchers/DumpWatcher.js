import WatcherEntry, { WatcherEntryCollectionType, WatcherEntryDataType } from "../WatcherEntry.js";
import DB from "../DB.js";
import { currentBatchId } from "../context.js";
export class DumpWatcherEntry extends WatcherEntry {
    constructor(data, batchId) {
        super(WatcherEntryDataType.dumps, data, batchId);
    }
}
export function dump(data) {
    const watcher = new DumpWatcher(data);
    watcher.save();
}
class DumpWatcher {
    constructor(data) {
        this.data = data;
    }
    save() {
        const entry = new DumpWatcherEntry({
            dump: this.data
        }, currentBatchId());
        DB.dumps().save(entry);
    }
}
DumpWatcher.entryType = WatcherEntryCollectionType.dump;
export default DumpWatcher;
