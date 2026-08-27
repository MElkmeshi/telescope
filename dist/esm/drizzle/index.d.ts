import Telescope from "../api/Telescope.js";
/**
 * Wraps the underlying pg/Neon pool. This is the seam that catches everything:
 * drizzle's query builder (db.select/insert/update/delete) executes through
 * client.query(), not through the db object's own methods, so wrapping `db`
 * alone captures only raw db.execute() calls.
 *
 * Both node-postgres and Neon's serverless Pool expose the same query()
 * surface, so one wrapper covers both drivers.
 */
export declare function wrapPool<T extends object>(pool: T, telescope: Telescope): T;
export declare function wrapDrizzle<T extends object>(db: T, telescope: Telescope): T;
