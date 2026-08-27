import DatabaseDriver, { WatcherData } from "./DatabaseDriver.js";
import WatcherEntry, { WatcherEntryCollectionType, WatcherType } from "../WatcherEntry.js";
/**
 * The slice of a connection pool this driver needs.
 *
 * Declared structurally rather than importing from `pg` so the package gains
 * no runtime dependency on a database client: node-postgres pools and
 * @neondatabase/serverless pools both satisfy it, and the host application
 * passes in whichever one it already has.
 */
export interface QueryablePool {
    query(text: string, values?: any[]): Promise<{
        rows: any[];
        rowCount?: number | null;
    }>;
}
export interface PostgresDriverOptions {
    pool: QueryablePool;
    /** Defaults to `telescope_entries`. */
    tableName?: string;
    /**
     * Per-collection ceiling. Unlike the in-memory drivers this is enforced
     * during prune rather than on every insert: bounding it on write would mean
     * a window function on each recorded entry, which is a real cost on the
     * request path for a debug tool. 0 disables it.
     */
    maxEntries?: number;
    /**
     * Create the table and indexes on first use. Convenient for local work.
     * Turn it off and run `schemaSql()` as a real migration when the schema of
     * the target database is managed elsewhere.
     */
    autoMigrate?: boolean;
}
/** DDL for the entries table. Exported so it can be run as a real migration. */
export declare function schemaSql(tableName?: string): string;
export default class PostgresDriver implements DatabaseDriver {
    private pool;
    private table;
    private maxEntries;
    private autoMigrate;
    private migration?;
    constructor(options: PostgresDriverOptions);
    get<T extends WatcherType>(name: WatcherEntryCollectionType, take?: number, tag?: string): Promise<WatcherEntry<T>[]>;
    find<T extends WatcherType>(name: WatcherEntryCollectionType, id: string): Promise<WatcherEntry<T> | undefined>;
    batch(batchId: string): Promise<WatcherEntry<any>[]>;
    save<T extends WatcherType>(name: WatcherEntryCollectionType, data: WatcherEntry<T>): Promise<void>;
    /**
     * Replace the entry at `index` in this collection's newest-first ordering.
     *
     * The in-memory drivers splice the old entry out and unshift the new one,
     * so the replacement ends up at the front. Deleting the row and inserting
     * the new entry reproduces that: the new row carries a newer created_at and
     * therefore sorts first.
     */
    update<T extends WatcherType>(name: WatcherEntryCollectionType, index: number, toUpdate: WatcherEntry<T>): Promise<void>;
    prune(before: Date): Promise<number>;
    truncate(): Promise<void>;
    /** Runs at most once per driver instance. */
    private migrate;
    private enforceLimit;
}
export type { WatcherData };
