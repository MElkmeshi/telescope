import DatabaseDriver from "./drivers/DatabaseDriver.js";
import WatcherEntry, { WatcherEntryCollectionType, WatcherType } from "./WatcherEntry.js";
export type Driver = new () => DatabaseDriver;
declare class DB {
    private static driver;
    private static db?;
    private constructor();
    static configure(driver: Driver): void;
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
