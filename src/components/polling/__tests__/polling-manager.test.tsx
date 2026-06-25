import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { db, newId, nowISO } from '@/db'
import { PollingManager } from '@/components/polling/polling-manager'
import { setLeaderMock } from '@/lib/__mocks__/leader-lock'
import {
  getRunCycleCalls,
  clearRunCycleCalls,
} from '@/lib/poll/__mocks__/run-cycle'

vi.mock('@/lib/leader-lock')
vi.mock('@/lib/poll/run-cycle')

function setLeader(value: boolean) {
  setLeaderMock(value)
}

async function tick(ms = 10) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function seedActiveSession(intervalMs = 20) {
  const id = newId()
  await db.sessions.add({
    id,
    name: 'test session',
    status: 'active',
    pollIntervalMs: intervalMs,
    timeoutMs: 5000,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  })
  return id
}

describe('PollingManager', () => {
  let container: HTMLDivElement | null = null

  beforeEach(async () => {
    clearRunCycleCalls()
    setLeaderMock(false)
    await db.delete()
    await db.open()
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(async () => {
    if (container) {
      container.remove()
      container = null
    }
    await db.delete()
  })

  it('does not poll when not leader', async () => {
    await act(async () => {
      createRoot(container!).render(<PollingManager />)
    })
    await seedActiveSession()
    await tick(50)
    expect(getRunCycleCalls()).toHaveLength(0)
  })

  it('polls active sessions when leader', async () => {
    await act(async () => {
      createRoot(container!).render(<PollingManager />)
    })
    const id = await seedActiveSession(20)
    setLeader(true)
    await tick(30)
    expect(getRunCycleCalls().filter((c) => c === id).length).toBeGreaterThanOrEqual(1)
  })

  it('stops polling a session when it becomes inactive', async () => {
    await act(async () => {
      createRoot(container!).render(<PollingManager />)
    })
    const id = await seedActiveSession(20)
    setLeader(true)
    await tick(30)
    expect(getRunCycleCalls().filter((c) => c === id).length).toBeGreaterThanOrEqual(1)

    await db.sessions.update(id, { status: 'paused' })
    clearRunCycleCalls()
    await tick(50)
    expect(getRunCycleCalls()).toHaveLength(0)
  })

  it('stops all polling when leader is lost', async () => {
    await act(async () => {
      createRoot(container!).render(<PollingManager />)
    })
    const id = await seedActiveSession(20)
    setLeader(true)
    await tick(30)
    expect(getRunCycleCalls().filter((c) => c === id).length).toBeGreaterThanOrEqual(1)

    setLeader(false)
    clearRunCycleCalls()
    await tick(50)
    expect(getRunCycleCalls()).toHaveLength(0)
  })
})
