import { db } from '@/db'
import type { Source, FieldMapping, DerivedMetric } from '@/db'
import type { StatCardData } from '@/components/dashboard/stat-cards'
import { getRecentCycles } from './history'

/**
 * Compute stat card data for a session.
 *
 * Reads the latest two poll cycles, then builds one stat card per
 * field mapping + derived metric with latest value, previous value,
 * and delta direction.
 *
 * @param sessionId - The session to compute cards for
 * @param sources - All sources for the session (pre-loaded by caller)
 * @param mappings - All field mappings for the session
 * @param derivedMetrics - All derived metrics for the session
 */
export async function computeStatCards(
  sessionId: string,
  sources: Source[],
  mappings: FieldMapping[],
  derivedMetrics: DerivedMetric[],
): Promise<StatCardData[]> {
  const cards: StatCardData[] = []
  const enabledSourceIds = new Set(sources.filter((source) => source.enabled).map((source) => source.id))
  const mappingsById = new Map(mappings.map((mapping) => [mapping.id, mapping]))

  async function loadCycleData(cycleId: string) {
    const sourceResults = await db.sourceResults.where('cycleId').equals(cycleId).toArray()
    const sourceResultIds = sourceResults.map((result) => result.id)
    const errMap = new Map(sourceResults.map((result) => [result.sourceId, result.error]))

    const [mappedValues, derivedValues] = await Promise.all([
      sourceResultIds.length > 0
        ? db.mappedValues.where('sourceResultId').anyOf(sourceResultIds).toArray()
        : Promise.resolve([]),
      db.derivedValues.where('cycleId').equals(cycleId).toArray(),
    ])

    return { sourceResults, mappedValues, derivedValues, errMap }
  }

  function isCycleComplete(data: Awaited<ReturnType<typeof loadCycleData>>) {
    if (data.sourceResults.length < enabledSourceIds.size) return false

    const successfulSourceIds = new Set(
      data.sourceResults
        .filter((result) => result.success && result.rawJson !== null && result.rawJson !== undefined)
        .map((result) => result.sourceId),
    )
    const expectedMappedCount = mappings.filter((mapping) => successfulSourceIds.has(mapping.sourceId)).length

    if (data.mappedValues.length < expectedMappedCount) return false
    if (derivedMetrics.length > 0 && data.derivedValues.length < derivedMetrics.length) return false

    return true
  }

  const candidateCycles = await getRecentCycles(sessionId, 5)
  const candidateData = await Promise.all(
    candidateCycles.map(async (cycle) => ({
      cycle,
      ...(await loadCycleData(cycle.id)),
    })),
  )
  const completeCycles = candidateData.filter((entry) => isCycleComplete(entry))
  const latest = completeCycles[0]
  const previous = completeCycles[1]

  // Build sourceId → source lookup
  const sourcesMap = new Map(sources.map((s) => [s.id, s]))

  function buildValueMap(data: (typeof completeCycles)[number] | undefined) {
    const valueMap = new Map<string, number>()
    if (!data) return valueMap

    for (const value of data.mappedValues) {
      const mapping = mappingsById.get(value.mappingId)
      if (!mapping) continue
      const source = sourcesMap.get(mapping.sourceId)
      const key = `${source?.key ?? '?'}.${mapping.key}`
      if (typeof value.value === 'number') valueMap.set(key, value.value)
    }

    return valueMap
  }

  const latestValues = buildValueMap(latest)
  const previousValues = buildValueMap(previous)

  for (const mapping of mappings) {
    const source = sourcesMap.get(mapping.sourceId)
    const key = `${source?.key ?? '?'}.${mapping.key}`
    cards.push({
      key,
      label: mapping.label,
      latestValue: latestValues.get(key) ?? null,
      previousValue: previousValues.get(key) ?? null,
      error: latest?.errMap.get(mapping.sourceId) ?? null,
    })
  }

  if (latest) {
    const latestDerivedValues = new Map(latest.derivedValues.map((value) => [value.metricId, value.value]))
    const previousDerivedValues = new Map(
      (previous?.derivedValues ?? []).map((value) => [value.metricId, value.value]),
    )

    for (const metric of derivedMetrics) {
      cards.push({
        key: metric.key,
        label: metric.label,
        latestValue: latestDerivedValues.get(metric.id) ?? null,
        previousValue: previousDerivedValues.get(metric.id) ?? null,
      })
    }
  }

  return cards
}
