import DB from "../DB.js"
import WatcherEntry, {WatcherEntryCollectionType, WatcherEntryDataType} from "../WatcherEntry.js"
import {hostname} from "os"
import Telescope from "../Telescope.js"
import JSONFileSyncAdapter from "../drivers/JSONFileSyncAdapter.js"
import {currentBatchId} from "../context.js"

export const LogLevel = {
    INFO: "info",
    WARNING: "warning",
    ERROR: "error",
} as const

export type LogLevel = typeof LogLevel[keyof typeof LogLevel]

export interface LogWatcherData
{
    context: object | any[]
    hostname: string
    level: LogLevel
    message: string
}

export class LogWatcherEntry extends WatcherEntry<LogWatcherData>
{
    constructor(data: LogWatcherData, batchId?: string)
    {
        super(WatcherEntryDataType.logs, data, batchId)
    }
}

export default class LogWatcher
{
    public static entryType = WatcherEntryCollectionType.log

    // Kept so repeated setup() re-wraps the original console methods rather
    // than wrapping the previous wrapper.
    private static originalLog?: typeof console.log
    private static originalWarn?: typeof console.warn

    private data: LogWatcherData

    constructor(data: any[], level: LogLevel)
    {
        this.data = {
            hostname: hostname(),
            level,
            message: this.getMessage(data),
            context: data,
        }
    }

    public static capture(telescope: Telescope)
    {
        const oldLog = LogWatcher.originalLog ??= console.log

        console.log = (...data: any[]) => {
            oldLog(...data)

            if (typeof data[0] == 'string') {
                data[0] = data[0].split('[32m').join('')
                data[0] = data[0].split('[39m').join('')
            }

            const watcher = new LogWatcher(data, LogLevel.INFO)

            watcher.save()
        }

        const oldWarn = LogWatcher.originalWarn ??= console.warn

        console.warn = (...data: any[]) => {
            oldWarn(...data)

            const watcher = new LogWatcher(data, LogLevel.WARNING)

            watcher.save()
        }

        /* console.error handles ErrorWatcher
        const oldError = console.error

        console.error = (...data: any[]) => {
            oldError(...data)

            const watcher = new LogWatcher(data, LogLevel.ERROR)

            watcher.save()
        }
        */
    }

    public save()
    {
        const entry = new LogWatcherEntry(this.data, currentBatchId())

        DB.logs().save(entry)
    }

    private getMessage(data: any[]): string
    {
        let message = data.shift()

        if (typeof message !== 'string') {
            message = JSON.stringify(message, JSONFileSyncAdapter.getRefReplacer())
        }

        return message
    }
}