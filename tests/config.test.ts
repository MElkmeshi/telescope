import express from "express"
import Telescope from "../src/api/Telescope.js"

describe('instance configuration', () => {
    it('keeps configuration independent between instances', () => {
        const a = Telescope.setup(express(), {responseSizeLimit: 16})
        const b = Telescope.setup(express(), {responseSizeLimit: 128})

        expect(a.config.responseSizeLimit).toBe(16)
        expect(b.config.responseSizeLimit).toBe(128)
    })

    it('applies defaults for omitted options', () => {
        const telescope = Telescope.setup(express())

        expect(telescope.config.responseSizeLimit).toBe(64)
        expect(telescope.config.paramsToHide).toEqual(['password', 'token', '_csrf'])
        expect(telescope.config.slowQueryThreshold).toBe(100)
        expect(telescope.config.enableClient).toBe(true)
        expect(telescope.config.path).toBe('telescope')
    })

    it('honours enableClient: false', () => {
        const telescope = Telescope.setup(express(), {enableClient: false})

        expect(telescope.config.enableClient).toBe(false)
    })

    it('ignores its own routes so the client does not record itself', () => {
        const telescope = Telescope.setup(express(), {path: '_debug'})

        expect(telescope.config.ignorePaths).toContain('/_debug*')
    })

    it('keeps user-supplied ignorePaths alongside its own', () => {
        const telescope = Telescope.setup(express(), {ignorePaths: ['/health']})

        expect(telescope.config.ignorePaths).toEqual(['/health', '/telescope*'])
    })

    it('normalises a path given with slashes', () => {
        const telescope = Telescope.setup(express(), {path: '/_debug/'})

        expect(telescope.config.path).toBe('_debug')
    })
})
