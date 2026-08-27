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
