import WatcherEntry from "../WatcherEntry.js";
import Telescope from "../Telescope.js";
import { ResolvedConfig } from "../config.js";
export interface ErrorWatcherData {
    hostname: string;
    class: string;
    file: string;
    message: string;
    trace: object[];
    line_preview: object;
    line: number;
    occurrences: number;
}
export declare class ErrorWatcherEntry extends WatcherEntry<ErrorWatcherData> {
    constructor(data: ErrorWatcherData, batchId?: string);
}
export default class ErrorWatcher {
    static entryType: "exceptions";
    private error;
    private config;
    constructor(error: Error, config: ResolvedConfig);
    static setup(telescope: Telescope): void;
    private getSameError;
    saveOrUpdate(): Promise<void>;
    private isSameError;
    shouldIgnore(): boolean;
    private getFileInfo;
    private getLinePreview;
    private getStackTrace;
}
