import { testFetch } from '@/lib/api'
import type { Source } from '@/db'
import type { SourceAdapter, SourceFetchResult } from './types'

/**
 * HTTP GET source adapter.
 *
 * Wraps `testFetch()` behind the SourceAdapter interface.
 * Takes a DB Source record and extracts the HTTP-specific config
 * (url, queryParams, authConfig).
 */
export class HttpSourceAdapter implements SourceAdapter {
  readonly type = 'http-poll'
  private source: Source

  constructor(source: Source) {
    this.source = source
  }

  async fetch(timeoutMs?: number, signal?: AbortSignal): Promise<SourceFetchResult> {
    const result = await testFetch({
      url: this.source.url,
      queryParams: this.source.queryParams,
      authConfig: this.source.authConfig,
      timeoutMs,
      signal,
    })

    return {
      ok: result.ok,
      data: result.data,
      statusCode: result.status,
      error: result.error ?? null,
      durationMs: result.durationMs,
    }
  }
}
