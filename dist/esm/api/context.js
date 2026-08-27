import { AsyncLocalStorage } from "node:async_hooks";
export const telescopeContext = new AsyncLocalStorage();
export function runWithContext(context, fn) {
    return telescopeContext.run(context, fn);
}
export function currentContext() {
    return telescopeContext.getStore();
}
export function currentBatchId() {
    var _a;
    return (_a = telescopeContext.getStore()) === null || _a === void 0 ? void 0 : _a.batchId;
}
/**
 * Entries raised outside any request — a cron job, a queue worker, boot-time
 * logging — have no context to inherit a decision from, so they are recorded.
 * Sampling only ever thins request traffic.
 */
export function shouldRecordCurrentBatch() {
    var _a, _b;
    return (_b = (_a = telescopeContext.getStore()) === null || _a === void 0 ? void 0 : _a.shouldRecord) !== null && _b !== void 0 ? _b : true;
}
