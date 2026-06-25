import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession, db, newId, nowISO, updateSessionStatus } from '@/db'
import { runCycle } from '../run-cycle'

vi.mock('@/lib/api', () => ({
  testFetch: vi.fn((config: { signal?: AbortSignal }) => new Promise((_, reject) => {
    config.signal?.addEventListener('abort', () => reject(new DOMException('Operation aborted', 'AbortError')), { once: true })
  })),
}))

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('runCycle abort handling', () => {
  it('cleans up partial poll data when aborted', async () => {
    const session = await createSession({ name: 'Abort Test' })
    await updateSessionStatus(session.id, 'active')

    await db.sources.add({
      id: newId(),
      sessionId: session.id,
      key: 'ads',
      name: 'Ads',
      type: 'http-poll',
      url: 'https://api.example.com/ads',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: nowISO(),
    })

    const controller = new AbortController()
    const runPromise = runCycle(session.id, controller.signal)
    await Promise.resolve()
    controller.abort()

    await expect(runPromise).rejects.toMatchObject({ name: 'AbortError' })
    expect(await db.pollCycles.toArray()).toHaveLength(0)
    expect(await db.sourceResults.toArray()).toHaveLength(0)
    expect(await db.mappedValues.toArray()).toHaveLength(0)
    expect(await db.derivedValues.toArray()).toHaveLength(0)
    expect(await db.warningEvents.toArray()).toHaveLength(0)
  })
})
