import DB from "../src/api/DB.js"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"
import Telescope from "../src/api/Telescope.js"
import express from "express"
import {wrapDrizzle} from "../src/drizzle/index.js"

describe('wrapDrizzle', () => {
    beforeEach(async () => {
        DB.configure(MemoryDriver)

        await DB.truncate()
    })

    it('records executed queries with a measured duration', async () => {
        const telescope = Telescope.setup(express())

        const db = wrapDrizzle({
            async execute(sql: string, params: unknown[] = []) {
                await new Promise(resolve => setTimeout(resolve, 20))

                return [{ok: true}]
            },
        }, telescope)

        await db.execute('select 1', [1])

        const [entry] = await DB.queries().get(10)

        expect(entry.content.sql).toBe('select 1')
        expect(entry.content.bindings).toEqual([1])
        expect(entry.content.time).toBeGreaterThanOrEqual(15)
        expect(entry.content.connection).toBe('drizzle')
    })

    it('records queries that throw, then rethrows', async () => {
        const telescope = Telescope.setup(express())

        const db = wrapDrizzle({
            async execute(sql: string) {
                throw new Error('syntax error')
            },
        }, telescope)

        await expect(db.execute('selct 1')).rejects.toThrow('syntax error')

        const [entry] = await DB.queries().get(10)

        expect(entry.content.sql).toBe('selct 1')
    })

    it('flags a slow query against the configured threshold', async () => {
        const telescope = Telescope.setup(express(), {slowQueryThreshold: 10})

        const db = wrapDrizzle({
            async execute(sql: string) {
                await new Promise(resolve => setTimeout(resolve, 30))

                return []
            },
        }, telescope)

        await db.execute('select pg_sleep(1)')

        const [entry] = await DB.queries().get(10)

        expect(entry.content.slow).toBe(true)
    })

    it('leaves non-query properties untouched', () => {
        const telescope = Telescope.setup(express())

        const db = wrapDrizzle({
            dialect: 'pg',
            async execute(sql: string) { return [] },
        }, telescope)

        expect(db.dialect).toBe('pg')
    })
})
