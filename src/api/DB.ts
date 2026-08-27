import LowDriver from "./drivers/LowDriver.js"
import DatabaseDriver, {DriverOptions} from "./drivers/DatabaseDriver.js"
import WatcherEntry, {WatcherEntryCollectionType, WatcherType} from "./WatcherEntry.js"
import {shouldRecordCurrentBatch} from "./context.js"

export type Driver = new (options?: DriverOptions) => DatabaseDriver;

export type EntryFilter = (entry: WatcherEntry<any>) => boolean

class DB
{
    private static driver: Driver = LowDriver
    private static db?: DatabaseDriver
    private static options: DriverOptions = {}
    private static filter?: EntryFilter

    private constructor()
    {
        DB.db = new DB.driver(DB.options)
    }

    /**
     * A driver may be given as a class or as an already-built instance.
     * Instances exist for drivers that need construction arguments a bare
     * `new Driver()` cannot supply — a connection pool, most obviously.
     */
    public static configure(driver: Driver | DatabaseDriver, options: DriverOptions = {})
    {
        DB.options = options

        if (typeof driver === 'function') {
            DB.driver = driver
            DB.db = undefined

            return
        }

        DB.db = driver
    }

    /** Applied to every entry before it reaches the driver. */
    public static configureFilter(filter?: EntryFilter)
    {
        DB.filter = filter
    }

    /**
     * Sampling is checked here rather than in each watcher so that every
     * collection honours it — a watcher added later cannot forget to.
     */
    private static shouldStore(entry: WatcherEntry<any>): boolean
    {
        if (!shouldRecordCurrentBatch()) {
            return false
        }

        return DB.filter ? DB.filter(entry) : true
    }

    public static async prune(before: Date): Promise<number>
    {
        const db = await DB.get()

        return db.prune ? db.prune(before) : 0
    }

    public static entry<T extends WatcherType, U extends WatcherEntry<T>>(name: WatcherEntryCollectionType)
    {
        return {
            get: async (take?: number) => (await DB.get()).get(name, take),
            find: async (id: string) => (await DB.get()).find(name, id),
            save: async (data: WatcherEntry<T>) => {
                if (!DB.shouldStore(data)) {
                    return
                }

                return (await DB.get()).save(name, data)
            },
            update: async (index: number, toUpdate: WatcherEntry<T>) => (await DB.get()).update(name, index, toUpdate),
        }
    }

    public static async batch(batchId: string)
    {
        return (await DB.get()).batch(batchId)
    }

    public static async truncate()
    {
        return (await DB.get()).truncate()
    }

    public static requests()
    {
        return this.entry(WatcherEntryCollectionType.request)
    }

    public static errors()
    {
        return this.entry(WatcherEntryCollectionType.exception)
    }

    public static dumps()
    {
        return this.entry(WatcherEntryCollectionType.dump)
    }

    public static logs()
    {
        return this.entry(WatcherEntryCollectionType.log)
    }

    public static queries()
    {
        return this.entry(WatcherEntryCollectionType.query)
    }

    public static clientRequests()
    {
        return this.entry(WatcherEntryCollectionType.clientRequest)
    }

    private static async get(): Promise<DatabaseDriver>
    {
        if (!DB.db) {
            new DB()
        }

        return DB.db!
    }
}

export default DB