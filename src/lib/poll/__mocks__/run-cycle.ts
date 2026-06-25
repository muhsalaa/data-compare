declare global {
  var __runCycleCalls: string[]
}

if (typeof globalThis.__runCycleCalls === 'undefined') {
  globalThis.__runCycleCalls = []
}

export function getRunCycleCalls(): string[] {
  return globalThis.__runCycleCalls
}

export function clearRunCycleCalls() {
  globalThis.__runCycleCalls.length = 0
}

export async function runCycle(sessionId: string): Promise<void> {
  globalThis.__runCycleCalls.push(sessionId)
}
