import { RequestWatcherData } from "./watchers/RequestWatcher.js";
import { ErrorWatcherData } from "./watchers/ErrorWatcher.js";
import { DumpWatcherData } from "./watchers/DumpWatcher.js";
import { LogWatcherData } from "./watchers/LogWatcher.js";
import { ClientRequestWatcherData } from "./watchers/ClientRequestWatcher.js";
import { QueryWatcherData } from "./watchers/QueryWatcher.js";
export declare const WatcherEntryDataType: {
    readonly requests: "request";
    readonly exceptions: "exception";
    readonly dumps: "dump";
    readonly logs: "log";
    readonly queries: "query";
    readonly clientRequests: "client-request";
};
export type WatcherEntryDataType = typeof WatcherEntryDataType[keyof typeof WatcherEntryDataType];
export declare const WatcherEntryCollectionType: {
    readonly request: "requests";
    readonly exception: "exceptions";
    readonly dump: "dumps";
    readonly log: "logs";
    readonly query: "queries";
    readonly clientRequest: "client-requests";
};
export type WatcherEntryCollectionType = typeof WatcherEntryCollectionType[keyof typeof WatcherEntryCollectionType];
export type WatcherType = RequestWatcherData | ErrorWatcherData | DumpWatcherData | ClientRequestWatcherData | LogWatcherData | QueryWatcherData;
export default abstract class WatcherEntry<T extends WatcherType> {
    content: any;
    created_at: string;
    family_hash: string;
    id: string;
    batchId?: string;
    sequence: number;
    tags: string[];
    type: WatcherEntryDataType;
    protected constructor(name: WatcherEntryDataType, data: T, batchId?: string);
}
