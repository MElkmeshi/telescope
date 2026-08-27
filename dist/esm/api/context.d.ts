import { AsyncLocalStorage } from "node:async_hooks";
export interface TelescopeContext {
    batchId: string;
    /**
     * Whether this batch is being recorded.
     *
     * Sampling is decided once, when the request opens, and every entry in the
     * batch inherits it. Deciding per entry would tear batches in half — a
     * request whose queries were dropped, or queries belonging to a request
     * that was never stored — and the UI resolves related entries by batchId,
     * so those fragments would show up as orphans.
     *
     * Optional: a context opened without one records, so callers of
     * runWithContext that predate sampling keep working unchanged.
     */
    shouldRecord?: boolean;
}
export declare const telescopeContext: AsyncLocalStorage<TelescopeContext>;
export declare function runWithContext<T>(context: TelescopeContext, fn: () => T): T;
export declare function currentContext(): TelescopeContext | undefined;
export declare function currentBatchId(): string | undefined;
/**
 * Entries raised outside any request — a cron job, a queue worker, boot-time
 * logging — have no context to inherit a decision from, so they are recorded.
 * Sampling only ever thins request traffic.
 */
export declare function shouldRecordCurrentBatch(): boolean;
