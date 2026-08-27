import WatcherEntry from "../WatcherEntry.js";
export interface DumpWatcherData {
    dump: string;
}
export declare class DumpWatcherEntry extends WatcherEntry<DumpWatcherData> {
    constructor(data: DumpWatcherData, batchId?: string);
}
export declare function dump(data: any): void;
export default class DumpWatcher {
    static entryType: "dumps";
    private data;
    constructor(data: any);
    save(): void;
}
