import DatabaseDriver, {DriverOptions, WatcherData} from "./DatabaseDriver.js"
import WatcherEntry, {WatcherEntryCollectionType, WatcherType} from "../WatcherEntry.js"
import {matchesTag} from "./tagMatch.js"

function emptyDb(): WatcherData
{
    return {
        requests: [],
        exceptions: [],
        dumps: [],
        logs: [],
        queries: [],
        "client-requests": [],
    }
}

export default class MemoryDriver implements DatabaseDriver
{
    private db: WatcherData
    private maxEntries: number

    constructor(options: DriverOptions = {})
    {
        this.db = emptyDb()
        this.maxEntries = options.maxEntries ?? 0
    }

    public async get<T extends WatcherType>(name: WatcherEntryCollectionType, take?: number, tag?: string): Promise<WatcherEntry<T>[]>
    {
        // Filter before slicing: taking 50 and then filtering would return
        // fewer than 50 matches, or none, whenever the tag is uncommon.
        const entries = (this.db[name] ?? []).filter((entry) => matchesTag(entry, tag))

        // Honouring `take` matters more here than for a file-backed driver:
        // this list is the whole recorded history, and the client asks for a
        // page of 50. Returning all of it serialised the entire buffer on
        // every poll.
        return take ? entries.slice(0, take) : entries
    }

    public async find<T extends WatcherType>(name: WatcherEntryCollectionType, id: string): Promise<WatcherEntry<T> | undefined>
    {
        return this.db[name]?.find((entry: WatcherEntry<T>) => entry.id === id)
    }

    public async batch(batchId: string): Promise<WatcherEntry<any>[]>
    {
        const batch: WatcherEntry<any>[] = []

        Object.keys(this.db).forEach((key) => {
            // @ts-ignore
            batch.push(this.db[key])
        })

        return batch.flat().filter((entry) => entry.batchId === batchId)
    }

    public async save<T extends keyof WatcherType>(name: WatcherEntryCollectionType, data: WatcherEntry<T>)
    {
        this.db[name]?.unshift(data)

        this.enforceLimit(name)
    }

    public async update<T extends keyof WatcherType>(name: WatcherEntryCollectionType, index: number, toUpdate: WatcherEntry<T>)
    {
        this.db[name].splice(index, 1)
        this.db[name]?.unshift(toUpdate)
    }

    public async prune(before: Date): Promise<number>
    {
        const cutoff = before.getTime()
        let pruned = 0

        for (const key of Object.keys(this.db) as WatcherEntryCollectionType[]) {
            const kept = this.db[key].filter((entry) => new Date(entry.created_at).getTime() >= cutoff)

            pruned += this.db[key].length - kept.length

            // @ts-ignore — key indexes a union of entry array types
            this.db[key] = kept
        }

        return pruned
    }

    public async truncate()
    {
        this.db = emptyDb()
    }

    /**
     * Entries are unshifted, so the newest are at the front and the tail is
     * what to drop.
     */
    private enforceLimit(name: WatcherEntryCollectionType): void
    {
        if (this.maxEntries > 0 && this.db[name].length > this.maxEntries) {
            this.db[name].length = this.maxEntries
        }
    }
}
