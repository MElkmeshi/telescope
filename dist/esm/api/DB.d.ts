import DatabaseDriver, { DriverOptions } from "./drivers/DatabaseDriver.js";
import WatcherEntry, { WatcherEntryCollectionType, WatcherType } from "./WatcherEntry.js";
export type Driver = new (options?: DriverOptions) => DatabaseDriver;
export type EntryFilter = (entry: WatcherEntry<any>) => boolean;
declare class DB {
    private static driver;
    private static db?;
    private static options;
    private static filter?;
    private constructor();
    /**
     * A driver may be given as a class or as an already-built instance.
     * Instances exist for drivers that need construction arguments a bare
     * `new Driver()` cannot supply — a connection pool, most obviously.
     */
    static configure(driver: Driver | DatabaseDriver, options?: DriverOptions): void;
    /** Applied to every entry before it reaches the driver. */
    static configureFilter(filter?: EntryFilter): void;
    /**
     * Sampling is checked here rather than in each watcher so that every
     * collection honours it — a watcher added later cannot forget to.
     */
    private static shouldStore;
    static prune(before: Date): Promise<number>;
    static entry<T extends WatcherType, U extends WatcherEntry<T>>(name: WatcherEntryCollectionType): {
        get: (take?: number) => Promise<WatcherEntry<WatcherType>[]>;
        find: (id: string) => Promise<WatcherEntry<WatcherType> | undefined>;
        save: (data: WatcherEntry<T>) => Promise<void>;
        update: (index: number, toUpdate: WatcherEntry<T>) => Promise<void>;
    };
    static batch(batchId: string): Promise<WatcherEntry<any>[]>;
    static truncate(): Promise<void>;
    static requests(): {
        get: (take?: number) => Promise<WatcherEntry<WatcherType>[]>;
        find: (id: string) => Promise<WatcherEntry<WatcherType> | undefined>;
        save: (data: WatcherEntry<WatcherType>) => Promise<void>;
        update: (index: number, toUpdate: WatcherEntry<WatcherType>) => Promise<void>;
    };
    static errors(): {
        get: (take?: number) => Promise<WatcherEntry<WatcherType>[]>;
        find: (id: string) => Promise<WatcherEntry<WatcherType> | undefined>;
        save: (data: WatcherEntry<WatcherType>) => Promise<void>;
        update: (index: number, toUpdate: WatcherEntry<WatcherType>) => Promise<void>;
    };
    static dumps(): {
        get: (take?: number) => Promise<WatcherEntry<WatcherType>[]>;
        find: (id: string) => Promise<WatcherEntry<WatcherType> | undefined>;
        save: (data: WatcherEntry<WatcherType>) => Promise<void>;
        update: (index: number, toUpdate: WatcherEntry<WatcherType>) => Promise<void>;
    };
    static logs(): {
        get: (take?: number) => Promise<WatcherEntry<WatcherType>[]>;
        find: (id: string) => Promise<WatcherEntry<WatcherType> | undefined>;
        save: (data: WatcherEntry<WatcherType>) => Promise<void>;
        update: (index: number, toUpdate: WatcherEntry<WatcherType>) => Promise<void>;
    };
    static queries(): {
        get: (take?: number) => Promise<WatcherEntry<WatcherType>[]>;
        find: (id: string) => Promise<WatcherEntry<WatcherType> | undefined>;
        save: (data: WatcherEntry<WatcherType>) => Promise<void>;
        update: (index: number, toUpdate: WatcherEntry<WatcherType>) => Promise<void>;
    };
    static clientRequests(): {
        get: (take?: number) => Promise<WatcherEntry<WatcherType>[]>;
        find: (id: string) => Promise<WatcherEntry<WatcherType> | undefined>;
        save: (data: WatcherEntry<WatcherType>) => Promise<void>;
        update: (index: number, toUpdate: WatcherEntry<WatcherType>) => Promise<void>;
    };
    private static get;
}
export default DB;
