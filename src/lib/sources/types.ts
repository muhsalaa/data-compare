/**
 * Raw result of fetching a source — the transport layer result
 * before any field mapping extraction.
 *
 * The `data` field holds the raw response (parsed JSON for HTTP sources).
 * Field mapping extraction is a separate pipeline stage (map-stage).
 *
 * As source types grow, this interface stays stable — each adapter
 * maps its transport to the same shape.
 */
export interface SourceFetchResult {
  ok: boolean
  data: unknown
  statusCode: number
  error: string | null
  durationMs: number
}

/**
 * Abstract source adapter.
 *
 * Each source type implements this interface. The pipeline calls
 * `fetch()` and gets back a standard result — it doesn't care
 * whether the source was an HTTP poll, a WebSocket, or a CSV upload.
 *
 * Future source types (WebSocket, SSE, CSV):
 *   class WsSourceAdapter implements SourceAdapter {
 *     readonly type = 'websocket'
 *     async fetch(timeoutMs, signal) { ... }
 *   }
 */
export interface SourceAdapter {
  readonly type: string
  fetch(timeoutMs?: number, signal?: AbortSignal): Promise<SourceFetchResult>
}
