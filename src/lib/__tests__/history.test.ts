import { describe, it, expect, beforeEach } from 'vitest'
import { db, newId } from '@/db'
import { getRecentCycles } from '@/lib/history'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function seedCycles(sessionId: string, count: number) {
  for (let i = 0; i < count; i++) {
    const future = new Date(Date.now() + i * 1000)
    await db.pollCycles.add({
      id: newId(),
      sessionId,
      timestamp: future.toISOString(),
    })
  }
}

describe('getRecentCycles', () => {
  it('returns the requested number of most recent cycles', async () => {
    const sessionId = 'sess-a'
    await seedCycles(sessionId, 50)

    const result = await getRecentCycles(sessionId, 10)

    expect(result).toHaveLength(10)
    // Should return newest first (descending timestamp)
    for (let i = 1; i < result.length; i++) {
      expect(new Date(result[i - 1].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(result[i].timestamp).getTime(),
      )
    }
  })

  it('returns all cycles when limit exceeds total count', async () => {
    const sessionId = 'sess-b'
    await seedCycles(sessionId, 5)

    const result = await getRecentCycles(sessionId, 10)

    expect(result).toHaveLength(5)
  })

  it('returns empty array when session has no cycles', async () => {
    const result = await getRecentCycles('nonexistent', 10)
    expect(result).toHaveLength(0)
  })

  it('does not return cycles from other sessions', async () => {
    const sidA = 'sess-c'
    const sidB = 'sess-d'
    await seedCycles(sidA, 10)
    await seedCycles(sidB, 10)

    const resultA = await getRecentCycles(sidA, 100)
    const resultB = await getRecentCycles(sidB, 100)

    expect(resultA).toHaveLength(10)
    expect(resultB).toHaveLength(10)
    const allIdsA = new Set(resultA.map((c) => c.sessionId))
    expect(allIdsA).toEqual(new Set([sidA]))
  })

  it('returns cycles in newest-first order', async () => {
    const sessionId = 'sess-e'
    // Insert 3 cycles with clearly different timestamps
    await db.pollCycles.add({ id: newId(), sessionId, timestamp: '2024-01-01T00:00:00.000Z' })
    await db.pollCycles.add({ id: newId(), sessionId, timestamp: '2024-01-03T00:00:00.000Z' })
    await db.pollCycles.add({ id: newId(), sessionId, timestamp: '2024-01-02T00:00:00.000Z' })

    const result = await getRecentCycles(sessionId, 10)

    expect(result).toHaveLength(3)
    expect(result[0].timestamp).toBe('2024-01-03T00:00:00.000Z')
    expect(result[1].timestamp).toBe('2024-01-02T00:00:00.000Z')
    expect(result[2].timestamp).toBe('2024-01-01T00:00:00.000Z')
  })
})
