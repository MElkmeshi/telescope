import DatabaseDriver, { DriverOptions } from "./DatabaseDriver.js";
import WatcherEntry, { WatcherEntryCollectionType, WatcherType } from "../WatcherEntry.js";
export default class MemoryDriver implements DatabaseDriver {
    private db;
    private maxEntries;
    constructor(options?: DriverOptions);
    get<T extends WatcherType>(name: WatcherEntryCollectionType, take?: number): Promise<WatcherEntry<T>[]>;
    find<T extends WatcherType>(name: WatcherEntryCollectionType, id: string): Promise<WatcherEntry<T> | undefined>;
    batch(batchId: string): Promise<WatcherEntry<any>[]>;
    save<T extends keyof WatcherType>(name: WatcherEntryCollectionType, data: WatcherEntry<T>): Promise<void>;
    update<T extends keyof WatcherType>(name: WatcherEntryCollectionType, index: number, toUpdate: WatcherEntry<T>): Promise<void>;
    prune(before: Date): Promise<number>;
    truncate(): Promise<void>;
    /**
     * Entries are unshifted, so the newest are at the front and the tail is
     * what to drop.
     */
    private enforceLimit;
}
