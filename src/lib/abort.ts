export function createAbortError(): Error {
  try {
    return new DOMException('Operation aborted', 'AbortError')
  } catch {
    const error = new Error('Operation aborted')
    error.name = 'AbortError'
    return error
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      typeof error.name === 'string' &&
      error.name === 'AbortError')
  )
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return

  if (signal.reason instanceof Error) {
    throw signal.reason
  }

  throw createAbortError()
}
