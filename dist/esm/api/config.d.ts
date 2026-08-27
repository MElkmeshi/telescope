import { NextFunction, Request, Response } from "express";
import { Driver } from "./DB.js";
import { GetUserFunction } from "./watchers/RequestWatcher.js";
export interface TelescopeOptions {
    enabledWatchers?: any[];
    databaseDriver?: Driver;
    responseSizeLimit?: number;
    paramsToHide?: string[];
    ignorePaths?: string[];
    clientIgnoreUrls?: string[];
    ignoreErrors?: ErrorConstructor[];
    isAuthorized?: (request: Request, response: Response, next: NextFunction) => void;
    getUser?: GetUserFunction;
    enableClient?: boolean;
    path?: string;
    slowQueryThreshold?: number;
    timezone?: string;
}
export interface ResolvedConfig {
    databaseDriver: Driver;
    responseSizeLimit: number;
    paramsToHide: string[];
    ignorePaths: string[];
    clientIgnoreUrls: string[];
    ignoreErrors: ErrorConstructor[];
    isAuthorized: (request: Request, response: Response, next: NextFunction) => void;
    getUser?: GetUserFunction;
    enableClient: boolean;
    path: string;
    slowQueryThreshold: number;
    timezone: string;
}
export declare function resolveConfig(options?: TelescopeOptions): ResolvedConfig;
