export const MIN_POLL_INTERVAL_MS = 5_000
export const DEFAULT_POLL_INTERVAL_MS = 30_000
export const MIN_TIMEOUT_MS = 1_000
export const DEFAULT_TIMEOUT_MS = 15_000
export const TIMEOUT_INTERVAL_RATIO = 0.8

export interface SessionTimingInput {
  pollIntervalMs: number
  timeoutMs: number
}

export function secondsToMs(seconds: number): number {
  return Math.round(seconds * 1000)
}

export function maxTimeoutMsForInterval(pollIntervalMs: number): number {
  return Math.floor(pollIntervalMs * TIMEOUT_INTERVAL_RATIO)
}

export function formatSeconds(seconds: number): string {
  return Number.isInteger(seconds) ? `${seconds}` : seconds.toFixed(1).replace(/\.0$/, '')
}

export function formatMsAsSeconds(ms: number): string {
  return formatSeconds(ms / 1000)
}

export function validateSessionTiming({ pollIntervalMs, timeoutMs }: SessionTimingInput): string | null {
  if (!Number.isFinite(pollIntervalMs)) {
    return 'Poll interval must be a valid number'
  }
  if (pollIntervalMs < MIN_POLL_INTERVAL_MS) {
    return `Poll interval must be at least ${formatMsAsSeconds(MIN_POLL_INTERVAL_MS)}s`
  }

  if (!Number.isFinite(timeoutMs)) {
    return 'Timeout must be a valid number'
  }
  if (timeoutMs < MIN_TIMEOUT_MS) {
    return `Timeout must be at least ${formatMsAsSeconds(MIN_TIMEOUT_MS)}s`
  }

  const maxTimeoutMs = maxTimeoutMsForInterval(pollIntervalMs)
  if (timeoutMs > maxTimeoutMs) {
    return `Timeout must be at most ${formatMsAsSeconds(maxTimeoutMs)}s (80% of the poll interval)`
  }

  return null
}

export function assertValidSessionTiming(input: SessionTimingInput): void {
  const error = validateSessionTiming(input)
  if (error) throw new Error(error)
}
