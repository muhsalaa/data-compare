import { useEffect, useRef, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Session } from '@/db'
import { runCycle } from '@/lib/poll/run-cycle'
import { isAbortError } from '@/lib/abort'
import { acquireLeaderLock } from '@/lib/leader-lock'

async function runPollLoop(session: Session, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    try {
      await runCycle(session.id, signal)
    } catch (error) {
      if (isAbortError(error)) return
      console.error('Polling cycle failed', session.id, error)
    }

    if (signal.aborted) return

    await new Promise<void>((resolve) => {
      const id = window.setTimeout(resolve, session.pollIntervalMs)
      signal.addEventListener('abort', () => clearTimeout(id), { once: true })
    })
  }
}

export function PollingManager() {
  const sessions = useLiveQuery(
    () => db.sessions.where('status').equals('active').toArray(),
    [],
    [],
  )

  const [isLeader, setIsLeader] = useState(false)
  const timersRef = useRef<Map<string, { controller: AbortController; intervalMs: number }>>(new Map())

  const sessionKey = useMemo(
    () => sessions.map((s) => `${s.id}:${s.pollIntervalMs}`).sort().join('|'),
    [sessions],
  )

  useEffect(() => {
    const lock = acquireLeaderLock('data-compare-polling', setIsLeader)
    return () => lock.release()
  }, [])

  useEffect(() => {
    if (!isLeader) {
      for (const { controller } of timersRef.current.values()) {
        controller.abort()
      }
      timersRef.current.clear()
      return
    }

    const desired = new Map(sessions.map((s) => [s.id, s]))

    // Stop timers for sessions that are no longer active or changed interval.
    for (const [id, timer] of timersRef.current) {
      const session = desired.get(id)
      if (!session || session.pollIntervalMs !== timer.intervalMs) {
        timer.controller.abort()
        timersRef.current.delete(id)
      }
    }

    // Start timers for newly active sessions.
    for (const session of sessions) {
      if (!timersRef.current.has(session.id)) {
        const controller = new AbortController()
        timersRef.current.set(session.id, { controller, intervalMs: session.pollIntervalMs })
        void runPollLoop(session, controller.signal)
      }
    }
  }, [isLeader, sessionKey, sessions])

  return null
}
