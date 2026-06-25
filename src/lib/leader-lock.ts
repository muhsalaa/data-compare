/**
 * Acquire a cross-tab leader lock using navigator.locks.
 *
 * Only one tab at a time will be the leader. If navigator.locks is not
 * available, this tab assumes it is the leader so polling still works.
 */
export interface LeaderLock {
  /** True if this tab currently holds the leader lock. */
  isLeader(): boolean
  /** Release the lock so another tab can become leader. */
  release(): void
}

export function acquireLeaderLock(
  name: string,
  onChange?: (isLeader: boolean) => void,
): LeaderLock {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    onChange?.(true)
    return {
      isLeader: () => true,
      release: () => {},
    }
  }

  let released = false
  let leader = false
  let releaseHold: (() => void) | null = null

  const hold = new Promise<void>((resolve) => {
    releaseHold = resolve
  })

  navigator.locks
    .request(name, async () => {
      leader = true
      onChange?.(true)
      await hold
      leader = false
      onChange?.(false)
    })
    .catch(() => {
      leader = false
      onChange?.(false)
    })

  return {
    isLeader: () => leader,
    release: () => {
      if (released) return
      released = true
      releaseHold?.()
    },
  }
}
