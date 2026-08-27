import WatcherEntry from "../WatcherEntry.js";
import { ResolvedConfig } from "../config.js";
/**
 * Shape is fixed by the bundled client: screens/queries/index.vue reads
 * `sql`, `time` and `slow`; preview.vue additionally reads `connection`.
 */
export interface QueryWatcherData {
    hostname: string;
    sql: string;
    bindings: unknown[];
    time: number;
    slow: boolean;
    connection: string;
}
export interface RecordedQuery {
    sql: string;
    bindings?: unknown[];
    time: number;
    connection?: string;
}
export declare class QueryWatcherEntry extends WatcherEntry<QueryWatcherData> {
    constructor(data: QueryWatcherData, batchId?: string);
}
export default class QueryWatcher {
    static entryType: "queries";
    static record(query: RecordedQuery, config: ResolvedConfig): Promise<void>;
}
