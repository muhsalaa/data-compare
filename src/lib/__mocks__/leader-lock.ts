declare global {
  var __leaderMock: boolean
  var __leaderCallbacks: Set<(value: boolean) => void>
}

if (typeof globalThis.__leaderCallbacks === 'undefined') {
  globalThis.__leaderCallbacks = new Set()
}

export function setLeaderMock(value: boolean) {
  globalThis.__leaderMock = value
  globalThis.__leaderCallbacks.forEach((cb) => cb(value))
}

export function getLeaderMock(): boolean {
  return globalThis.__leaderMock ?? false
}

export function acquireLeaderLock(
  _name: string,
  onChange?: (isLeader: boolean) => void,
) {
  if (onChange) {
    globalThis.__leaderCallbacks.add(onChange)
    onChange(getLeaderMock())
  }
  return {
    isLeader: () => getLeaderMock(),
    release: () => {
      if (onChange) {
        globalThis.__leaderCallbacks.delete(onChange)
      }
    },
  }
}
