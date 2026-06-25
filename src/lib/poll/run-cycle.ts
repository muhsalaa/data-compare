import { db, newId, nowISO } from '@/db'
import { isAbortError, throwIfAborted } from '@/lib/abort'
import type { PollCycle } from '@/db'
import { cascadeDelete } from '@/db/cascade'
import { fetchSources } from './fetch-stage'
import { extractMappedValues } from './map-stage'
import { evaluateDerivedMetrics } from './derive-stage'
import { evaluateWarningRules } from './warn-stage'

/**
 * Run one full poll cycle for a session.
 *
 * Pipeline stages (in order):
 *   1. Fetch — all enabled sources in parallel → source_results
 *   2. Map   — extract scalar values from responses → mapped_values
 *   3. Derive — evaluate derived metric formulas → derived_values
 *   4. Warn  — evaluate warning rules, emit events → warning_events
 *
 * Each stage can be tested independently by seeding IndexedDB
 * and calling its exported function directly.
 */
export async function runCycle(sessionId: string, signal?: AbortSignal): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session || session.status !== 'active') return

  throwIfAborted(signal)

  const sources = await db.sources
    .where('sessionId')
    .equals(sessionId)
    .filter((s) => s.enabled)
    .toArray()

  if (sources.length === 0) return

  const cycleId = newId()
  const cycleTimestamp = nowISO()

  const cycle: PollCycle = { id: cycleId, sessionId, timestamp: cycleTimestamp }
  await db.pollCycles.add(cycle)

  try {
    throwIfAborted(signal)

    // Stage 1 — Fetch
    const fetchResults = await fetchSources(sources, cycleId, session.timeoutMs, signal)

    throwIfAborted(signal)

    // Stage 2 — Map
    await extractMappedValues(fetchResults)

    throwIfAborted(signal)

    // Stage 3 — Derive
    await evaluateDerivedMetrics(sessionId, cycleId)

    throwIfAborted(signal)

    // Stage 4 — Warn
    await evaluateWarningRules(sessionId, cycleId)
  } catch (error) {
    if (isAbortError(error)) {
      await db.transaction('rw', db.tables, async () => {
        await cascadeDelete(db, 'pollCycles', [cycleId])
      })
    }
    throw error
  }
}
