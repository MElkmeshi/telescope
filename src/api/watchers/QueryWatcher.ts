import DB from "../DB.js"
import WatcherEntry, {WatcherEntryCollectionType, WatcherEntryDataType} from "../WatcherEntry.js"
import {currentBatchId} from "../context.js"
import {ResolvedConfig} from "../config.js"
import {hostname} from "node:os"

/**
 * Shape is fixed by the bundled client: screens/queries/index.vue reads
 * `sql`, `time` and `slow`; preview.vue additionally reads `connection`.
 */
export interface QueryWatcherData
{
    hostname: string
    sql: string
    bindings: unknown[]
    time: number
    slow: boolean
    connection: string
}

export interface RecordedQuery
{
    sql: string
    bindings?: unknown[]
    time: number
    connection?: string
}

export class QueryWatcherEntry extends WatcherEntry<QueryWatcherData>
{
    constructor(data: QueryWatcherData, batchId?: string)
    {
        super(WatcherEntryDataType.queries, data, batchId)
    }
}

export default class QueryWatcher
{
    public static entryType = WatcherEntryCollectionType.query

    public static async record(query: RecordedQuery, config: ResolvedConfig): Promise<void>
    {
        const entry = new QueryWatcherEntry({
            hostname: hostname(),
            sql: query.sql,
            bindings: query.bindings ?? [],
            time: query.time,
            slow: query.time >= config.slowQueryThreshold,
            connection: query.connection ?? 'default',
        }, currentBatchId())

        await DB.queries().save(entry)
    }
}
