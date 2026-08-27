import express from "express"
import {drizzle} from "drizzle-orm/node-postgres"
import {pgTable, serial, text} from "drizzle-orm/pg-core"
import DB from "../src/api/DB.js"
import MemoryDriver from "../src/api/drivers/MemoryDriver.js"
import Telescope from "../src/api/Telescope.js"
import {wrapPool} from "../src/drizzle/index.js"

const users = pgTable('users', {id: serial('id').primaryKey(), name: text('name')})

function fakeClient(delay = 0) {
    return {
        async query(..._args: unknown[]) {
            await new Promise(resolve => setTimeout(resolve, delay))

            return {rows: [], fields: [], rowCount: 0}
        }
    }
}

describe('wrapPool', () => {
    beforeEach(async () => {
        DB.configure(MemoryDriver)

        await DB.truncate()
    })

    it('captures drizzle query-builder calls, not just raw execute', async () => {
        const telescope = Telescope.setup(express())

        const db = drizzle({client: wrapPool(fakeClient(20), telescope) as any, schema: {users}})

        await db.select().from(users)

        const [entry] = await DB.queries().get(10)

        expect(entry).toBeDefined()
        expect(entry.content.sql).toContain('select')
        expect(entry.content.sql).toContain('"users"')
        expect(entry.content.time).toBeGreaterThanOrEqual(15)
    })

    it('captures bindings from a parameterised builder query', async () => {
        const telescope = Telescope.setup(express())

        const db = drizzle({client: wrapPool(fakeClient(), telescope) as any, schema: {users}})

        await db.insert(users).values({name: 'ada'})

        const [entry] = await DB.queries().get(10)

        expect(entry.content.sql).toContain('insert')
        expect(entry.content.bindings).toEqual(['ada'])
    })

    it('captures a direct pool.query(text, values) call', async () => {
        const telescope = Telescope.setup(express())

        const pool = wrapPool(fakeClient(), telescope) as any

        await pool.query('select * from users where id = $1', [7])

        const [entry] = await DB.queries().get(10)

        expect(entry.content.sql).toBe('select * from users where id = $1')
        expect(entry.content.bindings).toEqual([7])
    })
})
