import ky, { HTTPError, TimeoutError } from 'ky'
import { isAbortError } from '@/lib/abort'
import { formatMsAsSeconds } from '@/lib/session-timing'

export interface FetchResult {
  ok: boolean
  status: number
  data: unknown
  error?: string
  durationMs: number
}

export interface SourceConfig {
  url: string
  queryParams?: { key: string; value: string }[]
  authConfig?: {
    type: 'none' | 'bearer' | 'header'
    token?: string
    headerName?: string
    headerValue?: string
  }
  timeoutMs?: number
  signal?: AbortSignal
}

export async function testFetch(config: SourceConfig): Promise<FetchResult> {
  const start = performance.now()
  const url = buildUrl(config.url, config.queryParams ?? [])
  const headers = buildHeaders(config.authConfig)

  try {
    const res = await ky.get(url, {
      headers,
      timeout: config.timeoutMs ?? 15_000,
      retry: 0,
      signal: config.signal,
    })

    const data = await res.json()
    return {
      ok: true,
      status: res.status,
      data,
      durationMs: Math.round(performance.now() - start),
    }
  } catch (err) {
    const durationMs = Math.round(performance.now() - start)
    if (isAbortError(err)) {
      throw err
    }
    if (err instanceof TimeoutError) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: `Request timed out after ${formatMsAsSeconds(config.timeoutMs ?? 15_000)}s`,
        durationMs,
      }
    }
    if (err instanceof HTTPError) {
      const status = err.response.status
      let body: unknown = null
      try {
        body = await err.response.json()
      } catch {
        // body not JSON
      }
      return {
        ok: false,
        status,
        data: body,
        error: `HTTP ${status}${status === 401 ? ' — Unauthorized. Check your API key.' : ''}`,
        durationMs,
      }
    }
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
      durationMs,
    }
  }
}

function buildUrl(base: string, params: { key: string; value: string }[]): string {
  if (params.length === 0) return base
  const url = new URL(base)
  for (const { key, value } of params) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function buildHeaders(auth?: SourceConfig['authConfig']): Record<string, string> {
  if (!auth || auth.type === 'none') return {}
  if (auth.type === 'bearer') {
    return { Authorization: `Bearer ${auth.token ?? ''}` }
  }
  if (auth.type === 'header') {
    return { [auth.headerName ?? 'X-API-Key']: auth.headerValue ?? '' }
  }
  return {}
}
