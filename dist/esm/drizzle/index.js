var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import QueryWatcher from "../api/watchers/QueryWatcher.js";
/**
 * Drizzle's Logger interface only exposes logQuery(query, params), and it is
 * called before execution - so it cannot supply a duration, and the client's
 * Duration column and slow badge would always read zero. Wrapping the db
 * object instead lets us time the call itself.
 */
const TIMED_METHODS = ['execute', 'all', 'get', 'run', 'values'];
function isTimed(property) {
    return typeof property === 'string'
        && TIMED_METHODS.includes(property);
}
function resolve(source) {
    return typeof source === 'function' ? source() : source;
}
export function wrapPool(pool, telescope) {
    return new Proxy(pool, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (property !== 'query' || typeof value !== 'function') {
                // Pool methods rely on internal state, so keep them bound to
                // the real pool rather than to the proxy.
                return typeof value === 'function' ? value.bind(target) : value;
            }
            return (...args) => __awaiter(this, void 0, void 0, function* () {
                const start = process.hrtime.bigint();
                try {
                    return yield value.apply(target, args);
                }
                finally {
                    // Pools are usually built at module load, before the app
                    // (and so the Telescope instance) exists - hence the lazy
                    // form. Nothing is recorded until it resolves.
                    const instance = resolve(telescope);
                    if (instance && instance.recording) {
                        const elapsed = Number(process.hrtime.bigint() - start) / 1000000;
                        yield QueryWatcher.record(Object.assign(Object.assign({}, describeQuery(args)), { time: Math.round(elapsed * 100) / 100, connection: 'drizzle' }), instance.config);
                    }
                }
            });
        },
    });
}
/**
 * pool.query accepts either (text, values) or a config object carrying `text`
 * and sometimes `values`. drizzle uses the config form.
 */
function describeQuery(args) {
    var _a;
    const [query, params] = args;
    const config = query;
    const sql = typeof config === 'string'
        ? config
        : (_a = config === null || config === void 0 ? void 0 : config.text) !== null && _a !== void 0 ? _a : String(query);
    const bindings = Array.isArray(params)
        ? params
        : (typeof config === 'object' && Array.isArray(config === null || config === void 0 ? void 0 : config.values) ? config.values : []);
    return { sql, bindings };
}
export function wrapDrizzle(db, telescope) {
    return new Proxy(db, {
        get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (typeof value !== 'function' || !isTimed(property)) {
                return value;
            }
            return (...args) => __awaiter(this, void 0, void 0, function* () {
                const start = process.hrtime.bigint();
                try {
                    return yield value.apply(target, args);
                }
                finally {
                    const elapsed = Number(process.hrtime.bigint() - start) / 1000000;
                    const [sql, bindings] = args;
                    // Recorded in `finally` so failed queries are captured too.
                    yield QueryWatcher.record({
                        sql: typeof sql === 'string' ? sql : String(sql),
                        bindings: Array.isArray(bindings) ? bindings : [],
                        time: Math.round(elapsed * 100) / 100,
                        connection: 'drizzle',
                    }, telescope.config);
                }
            });
        },
    });
}
