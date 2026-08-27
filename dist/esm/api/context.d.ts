import { AsyncLocalStorage } from "node:async_hooks";
export interface TelescopeContext {
    batchId: string;
}
export declare const telescopeContext: AsyncLocalStorage<TelescopeContext>;
export declare function runWithContext<T>(context: TelescopeContext, fn: () => T): T;
export declare function currentContext(): TelescopeContext | undefined;
export declare function currentBatchId(): string | undefined;
