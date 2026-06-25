import { db, newId } from '@/db'
import { isAbortError, throwIfAborted } from '@/lib/abort'
import { createAdapter } from '@/lib/sources'
import type { Source } from '@/db'

/**
 * Result of fetching a single source — enough info for the map stage
 * to know which results have data to extract.
 */
export interface FetchSourceResult {
  sourceResultId: string
  sourceId: string
  success: boolean
  hasData: boolean
}

/**
 * Stage 1: Fetch all enabled sources in parallel.
 * Writes source_results to IndexedDB.
 * Returns an array of results for the map stage.
 */
export async function fetchSources(
  sources: Source[],
  cycleId: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<FetchSourceResult[]> {
  const results = await Promise.allSettled(
    sources.map(async (source): Promise<FetchSourceResult> => {
      const sourceResultId = newId()
      const start = performance.now()

      try {
        throwIfAborted(signal)
        const adapter = createAdapter(source)
        const result = await adapter.fetch(timeoutMs, signal)

        throwIfAborted(signal)

        await db.sourceResults.add({
          id: sourceResultId,
          cycleId,
          sourceId: source.id,
          success: result.ok,
          rawJson: result.data,
          statusCode: result.statusCode,
          error: result.error ?? null,
          durationMs: result.durationMs,
        })

        return {
          sourceResultId,
          sourceId: source.id,
          success: result.ok,
          hasData: result.ok && result.data !== null && result.data !== undefined,
        }
      } catch (err) {
        if (isAbortError(err)) {
          throw err
        }

        await db.sourceResults.add({
          id: sourceResultId,
          cycleId,
          sourceId: source.id,
          success: false,
          rawJson: null,
          statusCode: 0,
          error: err instanceof Error ? err.message : 'Unknown error',
          durationMs: Math.round(performance.now() - start),
        })

        return {
          sourceResultId,
          sourceId: source.id,
          success: false,
          hasData: false,
        }
      }
    }),
  )

  throwIfAborted(signal)

  // Flatten Promise.allSettled — errors are already caught per-source above,
  // but the outer allSettled wraps them; flatten anything unexpected
  const flattened: FetchSourceResult[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      flattened.push(r.value)
      continue
    }

    if (isAbortError(r.reason)) {
      throw r.reason
    }

    const sourceResultId = newId()
    await db.sourceResults.add({
      id: sourceResultId,
      cycleId,
      sourceId: 'unknown',
      success: false,
      rawJson: null,
      statusCode: 0,
      error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
      durationMs: 0,
    })
    flattened.push({ sourceResultId, sourceId: 'unknown', success: false, hasData: false })
  }

  return flattened
}
