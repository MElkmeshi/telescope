import QueryWatcher from "../api/watchers/QueryWatcher.js"
import Telescope from "../api/Telescope.js"

/**
 * Drizzle's Logger interface only exposes logQuery(query, params), and it is
 * called before execution - so it cannot supply a duration, and the client's
 * Duration column and slow badge would always read zero. Wrapping the db
 * object instead lets us time the call itself.
 */
const TIMED_METHODS = ['execute', 'all', 'get', 'run', 'values'] as const

type TimedMethod = typeof TIMED_METHODS[number]

function isTimed(property: string | symbol): property is TimedMethod
{
    return typeof property === 'string'
        && (TIMED_METHODS as readonly string[]).includes(property)
}

/**
 * Wraps the underlying pg/Neon pool. This is the seam that catches everything:
 * drizzle's query builder (db.select/insert/update/delete) executes through
 * client.query(), not through the db object's own methods, so wrapping `db`
 * alone captures only raw db.execute() calls.
 *
 * Both node-postgres and Neon's serverless Pool expose the same query()
 * surface, so one wrapper covers both drivers.
 */
export type TelescopeSource = Telescope | (() => Telescope | undefined)

function resolve(source: TelescopeSource): Telescope | undefined
{
    return typeof source === 'function' ? source() : source
}

export function wrapPool<T extends object>(pool: T, telescope: TelescopeSource): T
{
    return new Proxy(pool, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver)

            if (property !== 'query' || typeof value !== 'function') {
                // Pool methods rely on internal state, so keep them bound to
                // the real pool rather than to the proxy.
                return typeof value === 'function' ? value.bind(target) : value
            }

            return async (...args: unknown[]) => {
                const start = process.hrtime.bigint()

                try {
                    return await (value as Function).apply(target, args)
                } finally {
                    // Pools are usually built at module load, before the app
                    // (and so the Telescope instance) exists - hence the lazy
                    // form. Nothing is recorded until it resolves.
                    const instance = resolve(telescope)

                    if (instance && instance.recording) {
                        const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000

                        await QueryWatcher.record({
                            ...describeQuery(args),
                            time: Math.round(elapsed * 100) / 100,
                            connection: 'drizzle',
                        }, instance.config)
                    }
                }
            }
        },
    })
}

/**
 * pool.query accepts either (text, values) or a config object carrying `text`
 * and sometimes `values`. drizzle uses the config form.
 */
function describeQuery(args: unknown[]): {sql: string; bindings: unknown[]}
{
    const [query, params] = args

    const config = query as {text?: string; values?: unknown[]} | string | undefined

    const sql = typeof config === 'string'
        ? config
        : config?.text ?? String(query)

    const bindings = Array.isArray(params)
        ? params
        : (typeof config === 'object' && Array.isArray(config?.values) ? config.values : [])

    return {sql, bindings}
}

export function wrapDrizzle<T extends object>(db: T, telescope: Telescope): T
{
    return new Proxy(db, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver)

            if (typeof value !== 'function' || !isTimed(property)) {
                return value
            }

            return async (...args: unknown[]) => {
                const start = process.hrtime.bigint()

                try {
                    return await value.apply(target, args)
                } finally {
                    const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000

                    const [sql, bindings] = args

                    // Recorded in `finally` so failed queries are captured too.
                    await QueryWatcher.record({
                        sql: typeof sql === 'string' ? sql : String(sql),
                        bindings: Array.isArray(bindings) ? bindings : [],
                        time: Math.round(elapsed * 100) / 100,
                        connection: 'drizzle',
                    }, telescope.config)
                }
            }
        },
    })
}
