import { describe, it, expect, beforeEach } from 'vitest'
import { db, createSession, updateSessionDetails, updateSessionStatus, deleteSession } from '../index'

// Reset DB before each test
beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Session CRUD', () => {
  it('creates a session and reads it back', async () => {
    const s = await createSession({ name: 'Test Campaign' })

    const found = await db.sessions.get(s.id)
    expect(found).toBeDefined()
    expect(found!.name).toBe('Test Campaign')
    expect(found!.status).toBe('paused')
    expect(found!.pollIntervalMs).toBe(30_000)
    expect(found!.timeoutMs).toBe(15_000)
    expect(found!.id).toBe(s.id)
  })

  it('creates with custom interval and timeout', async () => {
    const s = await createSession({
      name: 'Fast Poll',
      pollIntervalMs: 10_000,
      timeoutMs: 8_000,
    })

    const found = await db.sessions.get(s.id)
    expect(found!.pollIntervalMs).toBe(10_000)
    expect(found!.timeoutMs).toBe(8_000)
  })

  it('persists an optional description', async () => {
    const s = await createSession({
      name: 'Campaign Monitor',
      description: 'Watch spend, donations, and ROAS for the current campaign.',
    })

    const found = await db.sessions.get(s.id)
    expect(found!.description).toBe('Watch spend, donations, and ROAS for the current campaign.')
  })

  it('rejects interval below 5 seconds', async () => {
    await expect(createSession({
      name: 'Too Fast',
      pollIntervalMs: 4_000,
      timeoutMs: 1_000,
    })).rejects.toThrow('at least 5s')
  })

  it('rejects timeout above 80% of interval', async () => {
    await expect(createSession({
      name: 'Too Slow',
      pollIntervalMs: 5_000,
      timeoutMs: 4_100,
    })).rejects.toThrow('80% of the poll interval')
  })

  it('lists all sessions', async () => {
    await createSession({ name: 'A' })
    await createSession({ name: 'B' })

    const all = await db.sessions.toArray()
    expect(all).toHaveLength(2)
  })

  it('pauses and resumes a session', async () => {
    const s = await createSession({ name: 'Toggle' })
    expect(s.status).toBe('paused')

    await updateSessionStatus(s.id, 'active')
    let found = await db.sessions.get(s.id)
    expect(found!.status).toBe('active')

    await updateSessionStatus(s.id, 'paused')
    found = await db.sessions.get(s.id)
    expect(found!.status).toBe('paused')
  })

  it('stops a session', async () => {
    const s = await createSession({ name: 'To Stop' })
    await updateSessionStatus(s.id, 'active')
    await updateSessionStatus(s.id, 'stopped')

    const found = await db.sessions.get(s.id)
    expect(found!.status).toBe('stopped')
  })

  it('deletes a session', async () => {
    const s = await createSession({ name: 'To Delete' })
    await deleteSession(s.id)

    const found = await db.sessions.get(s.id)
    expect(found).toBeUndefined()
  })

  it('updates session details including description', async () => {
    const s = await createSession({ name: 'Time' })

    await updateSessionDetails(s.id, {
      name: 'Time Updated',
      description: 'Used by AI copilot to explain campaign health.',
      pollIntervalMs: 30_000,
      timeoutMs: 15_000,
    })

    const found = await db.sessions.get(s.id)
    expect(found!.name).toBe('Time Updated')
    expect(found!.description).toBe('Used by AI copilot to explain campaign health.')
  })

  it('updatedAt changes on status change', async () => {
    const s = await createSession({ name: 'Time' })
    const original = s.updatedAt

    // Small delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 5))
    await updateSessionStatus(s.id, 'active')

    const found = await db.sessions.get(s.id)
    expect(found!.updatedAt).not.toBe(original)
  })
})
