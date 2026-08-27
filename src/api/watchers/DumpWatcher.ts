import WatcherEntry, {WatcherEntryCollectionType, WatcherEntryDataType} from "../WatcherEntry.js"
import DB from "../DB.js"
import {currentBatchId} from "../context.js"

export interface DumpWatcherData
{
    dump: string
}

export class DumpWatcherEntry extends WatcherEntry<DumpWatcherData>
{
    constructor(data: DumpWatcherData, batchId?: string)
    {
        super(WatcherEntryDataType.dumps, data, batchId)
    }
}

export function dump(data: any): void
{
    const watcher = new DumpWatcher(data)

    watcher.save()
}

export default class DumpWatcher
{
    public static entryType = WatcherEntryCollectionType.dump
    private data: any

    constructor(data: any)
    {
        this.data = data
    }

    public save()
    {
        const entry = new DumpWatcherEntry({
            dump: this.data
        }, currentBatchId())

        DB.dumps().save(entry)
    }
}