var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const COLLECTIONS = [
    "requests",
    "exceptions",
    "dumps",
    "logs",
    "queries",
    "client-requests",
];
/** DDL for the entries table. Exported so it can be run as a real migration. */
export function schemaSql(tableName = 'telescope_entries') {
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
`.trim();
}
export default class PostgresDriver {
    constructor(options) {
        var _a, _b, _c;
        this.pool = options.pool;
        this.table = (_a = options.tableName) !== null && _a !== void 0 ? _a : 'telescope_entries';
        this.maxEntries = (_b = options.maxEntries) !== null && _b !== void 0 ? _b : 0;
        this.autoMigrate = (_c = options.autoMigrate) !== null && _c !== void 0 ? _c : true;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(this.table)) {
            // The table name is interpolated into SQL — parameters cannot bind
            // identifiers — so it is validated once here rather than trusted.
            throw new Error(`Invalid Telescope table name: ${this.table}`);
        }
    }
    get(name, take) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.migrate();
            const { rows } = yield this.pool.query(`SELECT * FROM ${this.table} WHERE collection = $1 ORDER BY created_at DESC LIMIT $2`, [name, take !== null && take !== void 0 ? take : 50]);
            return rows.map(toEntry);
        });
    }
    find(name, id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.migrate();
            const { rows } = yield this.pool.query(`SELECT * FROM ${this.table} WHERE collection = $1 AND id = $2 LIMIT 1`, [name, id]);
            return rows[0] ? toEntry(rows[0]) : undefined;
        });
    }
    batch(batchId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.migrate();
            if (!batchId) {
                return [];
            }
            const { rows } = yield this.pool.query(`SELECT * FROM ${this.table} WHERE batch_id = $1 ORDER BY created_at DESC`, [batchId]);
            return rows.map(toEntry);
        });
    }
    save(name, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            yield this.migrate();
            yield this.pool.query(`INSERT INTO ${this.table}
                 (id, batch_id, collection, type, family_hash, sequence, tags, content, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (id) DO NOTHING`, [
                data.id,
                (_a = data.batchId) !== null && _a !== void 0 ? _a : null,
                name,
                data.type,
                data.family_hash,
                data.sequence,
                JSON.stringify((_b = data.tags) !== null && _b !== void 0 ? _b : []),
                safeJson(data.content),
                data.created_at,
            ]);
        });
    }
    /**
     * Replace the entry at `index` in this collection's newest-first ordering.
     *
     * The in-memory drivers splice the old entry out and unshift the new one,
     * so the replacement ends up at the front. Deleting the row and inserting
     * the new entry reproduces that: the new row carries a newer created_at and
     * therefore sorts first.
     */
    update(name, index, toUpdate) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.migrate();
            const { rows } = yield this.pool.query(`SELECT id FROM ${this.table} WHERE collection = $1 ORDER BY created_at DESC OFFSET $2 LIMIT 1`, [name, Math.max(0, index)]);
            if (rows[0]) {
                yield this.pool.query(`DELETE FROM ${this.table} WHERE id = $1`, [rows[0].id]);
            }
            yield this.save(name, toUpdate);
        });
    }
    prune(before) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.migrate();
            const { rowCount } = yield this.pool.query(`DELETE FROM ${this.table} WHERE created_at < $1`, [before.toISOString()]);
            return (rowCount !== null && rowCount !== void 0 ? rowCount : 0) + (yield this.enforceLimit());
        });
    }
    truncate() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.migrate();
            yield this.pool.query(`DELETE FROM ${this.table}`);
        });
    }
    /** Runs at most once per driver instance. */
    migrate() {
        var _a;
        if (!this.autoMigrate) {
            return Promise.resolve();
        }
        // Cached rather than guarded by a boolean: concurrent first requests
        // would otherwise each start their own CREATE TABLE.
        (_a = this.migration) !== null && _a !== void 0 ? _a : (this.migration = this.pool.query(schemaSql(this.table)).then(() => undefined));
        return this.migration;
    }
    enforceLimit() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.maxEntries <= 0) {
                return 0;
            }
            let deleted = 0;
            for (const collection of COLLECTIONS) {
                const { rowCount } = yield this.pool.query(`DELETE FROM ${this.table}
                  WHERE collection = $1
                    AND id NOT IN (
                        SELECT id FROM ${this.table}
                         WHERE collection = $1
                         ORDER BY created_at DESC
                         LIMIT $2
                    )`, [collection, this.maxEntries]);
                deleted += rowCount !== null && rowCount !== void 0 ? rowCount : 0;
            }
            return deleted;
        });
    }
}
/**
 * Rebuild the stored shape the client expects. WatcherEntry's constructor
 * generates a fresh id and timestamp, so rows are mapped to plain objects
 * rather than instantiated.
 */
function toEntry(row) {
    var _a, _b, _c, _d;
    return {
        id: row.id,
        batchId: (_a = row.batch_id) !== null && _a !== void 0 ? _a : undefined,
        type: row.type,
        family_hash: (_b = row.family_hash) !== null && _b !== void 0 ? _b : '',
        sequence: (_c = row.sequence) !== null && _c !== void 0 ? _c : 0,
        tags: (_d = row.tags) !== null && _d !== void 0 ? _d : [],
        content: row.content,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    };
}
/**
 * Entry content can contain circular references — an Express request reachable
 * from a logged object, most often. JSON.stringify would throw on the request
 * path, so cycles are replaced rather than allowed to abort the write.
 */
function safeJson(content) {
    const seen = new WeakSet();
    return JSON.stringify(content, (_key, value) => {
        if (typeof value !== 'object' || value === null) {
            return value;
        }
        if (seen.has(value)) {
            return '[Circular]';
        }
        seen.add(value);
        return value;
    });
}
