import WatcherEntry, { WatcherEntryCollectionType, WatcherType } from "../WatcherEntry.js";
import { RequestWatcherData } from "../watchers/RequestWatcher.js";
import { ErrorWatcherData } from "../watchers/ErrorWatcher.js";
import { DumpWatcherData } from "../watchers/DumpWatcher.js";
import { LogWatcherData } from "../watchers/LogWatcher.js";
import { ClientRequestWatcherData } from "../watchers/ClientRequestWatcher.js";
import { QueryWatcherData } from "../watchers/QueryWatcher.js";
export interface WatcherData {
    requests: WatcherEntry<RequestWatcherData>[];
    exceptions: WatcherEntry<ErrorWatcherData>[];
    dumps: WatcherEntry<DumpWatcherData>[];
    logs: WatcherEntry<LogWatcherData>[];
    queries: WatcherEntry<QueryWatcherData>[];
    "client-requests": WatcherEntry<ClientRequestWatcherData>[];
}
export interface DriverOptions {
    /** Per-collection ceiling enforced on write. 0 disables it. */
    maxEntries?: number;
}
export default interface DatabaseDriver {
    /**
     * Delete entries recorded before `before`. Returns how many went.
     *
     * Optional so third-party drivers written against the old contract keep
     * compiling; the sweeper skips any driver that does not implement it.
     */
    prune?(before: Date): Promise<number>;
    /**
     * `tag` filters to entries carrying a matching tag. Matching is a
     * case-insensitive substring so that typing `500` finds `status:500` and
     * `Auth:` finds every authenticated request, rather than demanding the
     * exact tag string.
     */
    get<T extends WatcherType>(name: WatcherEntryCollectionType, take?: number, tag?: string): Promise<WatcherEntry<T>[]>;
    find<T extends WatcherType>(name: WatcherEntryCollectionType, id: string): Promise<WatcherEntry<T> | undefined>;
    batch(batchId: string): Promise<WatcherEntry<any>[]>;
    save<T extends WatcherType>(name: WatcherEntryCollectionType, data: WatcherEntry<T>): Promise<void>;
    update<T extends WatcherType>(name: WatcherEntryCollectionType, index: number, toUpdate: WatcherEntry<T>): Promise<void>;
    truncate(): Promise<void>;
}
