import {existsSync, readFileSync} from "node:fs"
import {dirname, join} from "node:path"
import {fileURLToPath} from "node:url"
import {ResolvedConfig} from "./config.js"

/**
 * Locate the built client assets relative to this module rather than to
 * process.cwd(). Resolving by cwd and a hardcoded node_modules path breaks
 * under pnpm, Yarn PnP, and monorepos, where the package is not a direct
 * child of the consumer's node_modules.
 */
export function resolveClientDir(): string
{
    const here = dirname(fileURLToPath(import.meta.url))

    const candidates = [
        // published: dist/esm/api/client.js -> dist/
        join(here, '..', '..'),
        // from source: src/api/client.ts -> <repo>/dist/
        join(here, '..', '..', 'dist'),
    ]

    const found = candidates.find(dir => existsSync(join(dir, 'index.html')))

    if (!found) {
        throw new Error(
            `Telescope client assets not found. Looked in: ${candidates.join(', ')}`
        )
    }

    return found
}

/**
 * The client reads its mount path and timezone from a single global object
 * baked into index.html. Rewriting it at serve time is what makes the mount
 * path configurable without touching the bundle.
 */
export function renderIndex(html: string, config: ResolvedConfig, recording: boolean): string
{
    const globals = JSON.stringify({
        path: config.path,
        timezone: config.timezone,
        recording,
    })

    return html
        .replace(/window\.Telescope\s*=\s*\{[^}]*\};/, `window.Telescope = ${globals};`)
        .replace(/"\/telescope\//g, `"/${config.path}/`)
}

export function readIndex(config: ResolvedConfig, recording: boolean): string
{
    return renderIndex(
        readFileSync(join(resolveClientDir(), 'index.html'), 'utf8'),
        config,
        recording
    )
}
