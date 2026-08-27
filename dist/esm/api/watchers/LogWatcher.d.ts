import WatcherEntry from "../WatcherEntry.js";
import Telescope from "../Telescope.js";
export declare const LogLevel: {
    readonly INFO: "info";
    readonly WARNING: "warning";
    readonly ERROR: "error";
};
export type LogLevel = typeof LogLevel[keyof typeof LogLevel];
export interface LogWatcherData {
    context: object | any[];
    hostname: string;
    level: LogLevel;
    message: string;
}
export declare class LogWatcherEntry extends WatcherEntry<LogWatcherData> {
    constructor(data: LogWatcherData, batchId?: string);
}
export default class LogWatcher {
    static entryType: "logs";
    private static originalLog?;
    private static originalWarn?;
    private data;
    constructor(data: any[], level: LogLevel);
    static capture(telescope: Telescope): void;
    save(): void;
    private getMessage;
}
