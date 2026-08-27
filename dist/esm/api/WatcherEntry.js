import { randomUUID } from "node:crypto";
export const WatcherEntryDataType = {
    requests: "request",
    exceptions: "exception",
    dumps: "dump",
    logs: "log",
    clientRequests: "client-request",
};
export const WatcherEntryCollectionType = {
    request: "requests",
    exception: "exceptions",
    dump: "dumps",
    log: "logs",
    clientRequest: "client-requests",
};
export default class WatcherEntry {
    constructor(name, data, batchId) {
        this.id = randomUUID();
        this.created_at = new Date().toISOString();
        this.family_hash = '';
        this.sequence = Math.round(Math.random() * 100000);
        this.tags = [];
        this.type = name;
        this.content = data;
        this.batchId = batchId;
    }
}
