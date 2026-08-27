import {AsyncLocalStorage} from "node:async_hooks"

export interface TelescopeContext
{
    batchId: string

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
    shouldRecord?: boolean
}

export const telescopeContext = new AsyncLocalStorage<TelescopeContext>()

export function runWithContext<T>(context: TelescopeContext, fn: () => T): T
{
    return telescopeContext.run(context, fn)
}

export function currentContext(): TelescopeContext | undefined
{
    return telescopeContext.getStore()
}

export function currentBatchId(): string | undefined
{
    return telescopeContext.getStore()?.batchId
}

/**
 * Entries raised outside any request — a cron job, a queue worker, boot-time
 * logging — have no context to inherit a decision from, so they are recorded.
 * Sampling only ever thins request traffic.
 */
export function shouldRecordCurrentBatch(): boolean
{
    return telescopeContext.getStore()?.shouldRecord ?? true
}
