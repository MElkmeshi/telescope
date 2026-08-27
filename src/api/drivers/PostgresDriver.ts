import DatabaseDriver, {WatcherData} from "./DatabaseDriver.js"
import WatcherEntry, {WatcherEntryCollectionType, WatcherType} from "../WatcherEntry.js"

/**
 * The slice of a connection pool this driver needs.
 *
 * Declared structurally rather than importing from `pg` so the package gains
 * no runtime dependency on a database client: node-postgres pools and
 * @neondatabase/serverless pools both satisfy it, and the host application
 * passes in whichever one it already has.
 */
export interface QueryablePool
{
    query(text: string, values?: any[]): Promise<{rows: any[], rowCount?: number | null}>
}

export interface PostgresDriverOptions
{
    pool: QueryablePool

    /** Defaults to `telescope_entries`. */
    tableName?: string

    /**
     * Per-collection ceiling. Unlike the in-memory drivers this is enforced
     * during prune rather than on every insert: bounding it on write would mean
     * a window function on each recorded entry, which is a real cost on the
     * request path for a debug tool. 0 disables it.
     */
    maxEntries?: number

    /**
     * Create the table and indexes on first use. Convenient for local work.
     * Turn it off and run `schemaSql()` as a real migration when the schema of
     * the target database is managed elsewhere.
     */
    autoMigrate?: boolean
}

const COLLECTIONS: WatcherEntryCollectionType[] = [
    "requests",
    "exceptions",
    "dumps",
    "logs",
    "queries",
    "client-requests",
]

/** DDL for the entries table. Exported so it can be run as a real migration. */
export function schemaSql(tableName = 'telescope_entries'): string
{
    return `
CREATE TABLE IF NOT EXISTS ${tableName} (
    id           text PRIMARY KEY,
    batch_id     text,
    collection   text NOT NULL,
    type         text NOT NULL,
    family_hash  text,
    sequence     integer,
    tags         jsonb NOT NULL DEFAULT '[]'::jsonb,
    content      jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- The list view: newest-first within one collection.
CREATE INDEX IF NOT EXISTS ${tableName}_collection_created_at_idx
    ON ${tableName} (collection, created_at DESC);

-- Resolving the related entries shown on a detail page.
CREATE INDEX IF NOT EXISTS ${tableName}_batch_id_idx
    ON ${tableName} (batch_id);

-- Pruning by age.
CREATE INDEX IF NOT EXISTS ${tableName}_created_at_idx
    ON ${tableName} (created_at);
`.trim()
}

export default class PostgresDriver implements DatabaseDriver
{
    private pool: QueryablePool
    private table: string
    private maxEntries: number
    private autoMigrate: boolean
    private migration?: Promise<void>

    constructor(options: PostgresDriverOptions)
    {
        this.pool = options.pool
        this.table = options.tableName ?? 'telescope_entries'
        this.maxEntries = options.maxEntries ?? 0
        this.autoMigrate = options.autoMigrate ?? true

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(this.table)) {
            // The table name is interpolated into SQL — parameters cannot bind
            // identifiers — so it is validated once here rather than trusted.
            throw new Error(`Invalid Telescope table name: ${this.table}`)
        }
    }

    public async get<T extends WatcherType>(name: WatcherEntryCollectionType, take?: number): Promise<WatcherEntry<T>[]>
    {
        await this.migrate()

        const {rows} = await this.pool.query(
            `SELECT * FROM ${this.table} WHERE collection = $1 ORDER BY created_at DESC LIMIT $2`,
            [name, take ?? 50]
        )

        return rows.map(toEntry) as WatcherEntry<T>[]
    }

    public async find<T extends WatcherType>(name: WatcherEntryCollectionType, id: string): Promise<WatcherEntry<T> | undefined>
    {
        await this.migrate()

        const {rows} = await this.pool.query(
            `SELECT * FROM ${this.table} WHERE collection = $1 AND id = $2 LIMIT 1`,
            [name, id]
        )

        return rows[0] ? toEntry(rows[0]) as WatcherEntry<T> : undefined
    }

    public async batch(batchId: string): Promise<WatcherEntry<any>[]>
    {
        await this.migrate()

        if (!batchId) {
            return []
        }

        const {rows} = await this.pool.query(
            `SELECT * FROM ${this.table} WHERE batch_id = $1 ORDER BY created_at DESC`,
            [batchId]
        )

        return rows.map(toEntry)
    }

    public async save<T extends WatcherType>(name: WatcherEntryCollectionType, data: WatcherEntry<T>): Promise<void>
    {
        await this.migrate()

        await this.pool.query(
            `INSERT INTO ${this.table}
                 (id, batch_id, collection, type, family_hash, sequence, tags, content, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO NOTHING`,
            [
                data.id,
                data.batchId ?? null,
                name,
                data.type,
                data.family_hash,
                data.sequence,
                JSON.stringify(data.tags ?? []),
                safeJson(data.content),
                data.created_at,
            ]
        )
    }

    /**
     * Replace the entry at `index` in this collection's newest-first ordering.
     *
     * The in-memory drivers splice the old entry out and unshift the new one,
     * so the replacement ends up at the front. Deleting the row and inserting
     * the new entry reproduces that: the new row carries a newer created_at and
     * therefore sorts first.
     */
    public async update<T extends WatcherType>(name: WatcherEntryCollectionType, index: number, toUpdate: WatcherEntry<T>): Promise<void>
    {
        await this.migrate()

        const {rows} = await this.pool.query(
            `SELECT id FROM ${this.table} WHERE collection = $1 ORDER BY created_at DESC OFFSET $2 LIMIT 1`,
            [name, Math.max(0, index)]
        )

        if (rows[0]) {
            await this.pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [rows[0].id])
        }

        await this.save(name, toUpdate)
    }

    public async prune(before: Date): Promise<number>
    {
        await this.migrate()

        const {rowCount} = await this.pool.query(
            `DELETE FROM ${this.table} WHERE created_at < $1`,
            [before.toISOString()]
        )

        return (rowCount ?? 0) + await this.enforceLimit()
    }

    public async truncate(): Promise<void>
    {
        await this.migrate()

        await this.pool.query(`DELETE FROM ${this.table}`)
    }

    /** Runs at most once per driver instance. */
    private migrate(): Promise<void>
    {
        if (!this.autoMigrate) {
            return Promise.resolve()
        }

        // Cached rather than guarded by a boolean: concurrent first requests
        // would otherwise each start their own CREATE TABLE.
        this.migration ??= this.pool.query(schemaSql(this.table)).then(() => undefined)

        return this.migration
    }

    private async enforceLimit(): Promise<number>
    {
        if (this.maxEntries <= 0) {
            return 0
        }

        let deleted = 0

        for (const collection of COLLECTIONS) {
            const {rowCount} = await this.pool.query(
                `DELETE FROM ${this.table}
                  WHERE collection = $1
                    AND id NOT IN (
                        SELECT id FROM ${this.table}
                         WHERE collection = $1
                         ORDER BY created_at DESC
                         LIMIT $2
                    )`,
                [collection, this.maxEntries]
            )

            deleted += rowCount ?? 0
        }

        return deleted
    }
}

/**
 * Rebuild the stored shape the client expects. WatcherEntry's constructor
 * generates a fresh id and timestamp, so rows are mapped to plain objects
 * rather than instantiated.
 */
function toEntry(row: any): WatcherEntry<any>
{
    return {
        id: row.id,
        batchId: row.batch_id ?? undefined,
        type: row.type,
        family_hash: row.family_hash ?? '',
        sequence: row.sequence ?? 0,
        tags: row.tags ?? [],
        content: row.content,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    } as WatcherEntry<any>
}

/**
 * Entry content can contain circular references — an Express request reachable
 * from a logged object, most often. JSON.stringify would throw on the request
 * path, so cycles are replaced rather than allowed to abort the write.
 */
function safeJson(content: any): string
{
    const seen = new WeakSet()

    return JSON.stringify(content, (_key, value) => {
        if (typeof value !== 'object' || value === null) {
            return value
        }

        if (seen.has(value)) {
            return '[Circular]'
        }

        seen.add(value)

        return value
    })
}

export type {WatcherData}
