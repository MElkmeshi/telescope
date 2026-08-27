import {AsyncLocalStorage} from "node:async_hooks"

export interface TelescopeContext
{
    batchId: string
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
