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
