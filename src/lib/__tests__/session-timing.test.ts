import { describe, expect, it } from 'vitest'
import { maxTimeoutMsForInterval, validateSessionTiming } from '@/lib/session-timing'

describe('session timing validation', () => {
  it('accepts the minimum interval with an 80% timeout', () => {
    expect(validateSessionTiming({
      pollIntervalMs: 5_000,
      timeoutMs: 4_000,
    })).toBeNull()
  })

  it('rejects timeout above 80% of interval', () => {
    expect(validateSessionTiming({
      pollIntervalMs: 5_000,
      timeoutMs: 4_001,
    })).toContain('80% of the poll interval')
  })

  it('computes max timeout from interval', () => {
    expect(maxTimeoutMsForInterval(7_500)).toBe(6_000)
  })
})
