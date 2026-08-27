import DatabaseDriver, {DriverOptions, WatcherData} from "./DatabaseDriver.js"
import {unlinkSync} from "fs"
import WatcherEntry, {WatcherEntryCollectionType, WatcherType} from "../WatcherEntry.js"
import JSONFileSyncAdapter from "./JSONFileSyncAdapter.js"
import {matchesTag} from "./tagMatch.js"

export default class LowDriver implements DatabaseDriver
{
    private adapter: JSONFileSyncAdapter<WatcherData>
    private maxEntries: number
    private db: WatcherData = {
        requests: [],
        exceptions: [],
        dumps: [],
        logs: [],
        queries: [],
        "client-requests": [],
    }

    constructor(options: DriverOptions = {})
    {
        this.adapter = new JSONFileSyncAdapter<WatcherData>('db.json')
        this.maxEntries = options.maxEntries ?? 0

        this.adapter.read()
    }

    private read()
    {
        this.db = this.adapter.read() ?? this.db
    }

    private write()
    {
        this.adapter.write(this.db)
    }

    public async get<T extends WatcherType>(name: WatcherEntryCollectionType, take?: number, tag?: string): Promise<WatcherEntry<T>[]>
    {
        this.read()

        // Filter before slicing, or an uncommon tag yields an empty page.
        const entries = (this.db[name] ?? []).filter((entry) => matchesTag(entry, tag))

        return take ? entries.slice(0, take) : entries
    }

    public async find<T extends WatcherType>(name: WatcherEntryCollectionType, id: string): Promise<WatcherEntry<T> | undefined>
    {
        this.read()

        return this.db[name].find((entry: WatcherEntry<T>) => entry.id === id)
    }

    public async batch(batchId: string): Promise<WatcherEntry<any>[]>
    {
        this.read()

        const batch: WatcherEntry<any>[] = []

        Object.keys(this.db).forEach((key) => {
            // @ts-ignore
            batch.push(this.db[key])
        })

        return batch.flat().filter((entry) => entry.batchId === batchId)
    }

    public async save<T extends keyof WatcherType>(name: WatcherEntryCollectionType, data: WatcherEntry<T>)
    {
        this.read()

        this.db[name].unshift(data)

        if (this.maxEntries > 0 && this.db[name].length > this.maxEntries) {
            this.db[name].length = this.maxEntries
        }

        this.write()
    }

    public async update<T extends keyof WatcherType>(name: WatcherEntryCollectionType, index: number, toUpdate: WatcherEntry<T>)
    {
        this.read()

        this.db[name].splice(index, 1)
        this.db[name].unshift(toUpdate)

        this.write()
    }

    public async prune(before: Date): Promise<number>
    {
        this.read()

        const cutoff = before.getTime()
        let pruned = 0

        for (const key of Object.keys(this.db) as WatcherEntryCollectionType[]) {
            const kept = this.db[key].filter((entry) => new Date(entry.created_at).getTime() >= cutoff)

            pruned += this.db[key].length - kept.length

            // @ts-ignore — key indexes a union of entry array types
            this.db[key] = kept
        }

        if (pruned > 0) {
            this.write()
        }

        return pruned
    }

    public async truncate()
    {
        const dir = process.cwd() + '/db.json'

        unlinkSync(dir)
    }
}