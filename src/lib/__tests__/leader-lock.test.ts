import { describe, it, expect, vi, beforeEach } from 'vitest'
import { acquireLeaderLock } from '@/lib/leader-lock'

describe('acquireLeaderLock', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('assumes leader when navigator.locks is unavailable', () => {
    vi.stubGlobal('navigator', { locks: undefined })

    const onChange = vi.fn()
    const lock = acquireLeaderLock('test', onChange)

    expect(lock.isLeader()).toBe(true)
    expect(onChange).toHaveBeenCalledWith(true)

    lock.release()
    expect(lock.isLeader()).toBe(true)
  })

  it('becomes leader when lock is acquired and releases cleanly', async () => {
    const onChange = vi.fn()

    vi.stubGlobal(
      'navigator',
      {
        locks: {
          request: vi.fn((_name, callback) => {
            return Promise.resolve().then(async () => {
              await (callback as () => Promise<void>)()
            })
          }),
        },
      },
    )

    const lock = acquireLeaderLock('test', onChange)

    expect(lock.isLeader()).toBe(false)
    expect(onChange).not.toHaveBeenCalled()

    await Promise.resolve()

    expect(lock.isLeader()).toBe(true)
    expect(onChange).toHaveBeenCalledWith(true)

    lock.release()
    await Promise.resolve()

    expect(lock.isLeader()).toBe(false)
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

})
