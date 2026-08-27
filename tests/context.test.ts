import {randomUUID} from "node:crypto"
import {currentBatchId, runWithContext} from "../src/api/context.js"

describe('request context', () => {
    it('keeps batch ids isolated across concurrent async work', async () => {
        const seen: string[] = []

        const task = async (batchId: string, delay: number) =>
            runWithContext({batchId}, async () => {
                await new Promise(resolve => setTimeout(resolve, delay))

                seen.push(currentBatchId() ?? 'none')
            })

        const a = randomUUID()
        const b = randomUUID()

        // b is started second but finishes first - a shared mutable field
        // would let it overwrite a's id before a reads it back.
        await Promise.all([task(a, 30), task(b, 1)])

        expect(seen.sort()).toEqual([a, b].sort())
    })

    it('returns undefined outside any context', () => {
        expect(currentBatchId()).toBeUndefined()
    })
})
