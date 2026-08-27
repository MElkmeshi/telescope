import { ResolvedConfig } from "./config.js";
/**
 * Locate the built client assets relative to this module rather than to
 * process.cwd(). Resolving by cwd and a hardcoded node_modules path breaks
 * under pnpm, Yarn PnP, and monorepos, where the package is not a direct
 * child of the consumer's node_modules.
 */
export declare function resolveClientDir(): string;
/**
 * The client reads its mount path and timezone from a single global object
 * baked into index.html. Rewriting it at serve time is what makes the mount
 * path configurable without touching the bundle.
 */
export declare function renderIndex(html: string, config: ResolvedConfig, recording: boolean): string;
export declare function readIndex(config: ResolvedConfig, recording: boolean): string;
