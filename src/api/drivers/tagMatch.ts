import WatcherEntry from "../WatcherEntry.js"

/**
 * Case-insensitive substring match against an entry's tags.
 *
 * Substring rather than equality so the search box is usable: `500` finds
 * `status:500`, `Auth:` finds every authenticated request, and the full
 * `status:500` still works because equality is a subset of containment.
 */
export function matchesTag(entry: WatcherEntry<any>, tag?: string): boolean
{
    if (!tag) {
        return true
    }

    const needle = tag.trim().toLowerCase()

    if (!needle) {
        return true
    }

    return (entry.tags ?? []).some((entryTag) => entryTag.toLowerCase().includes(needle))
}
