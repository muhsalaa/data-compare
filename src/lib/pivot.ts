import { db } from '@/db'
import { getRecentCycles } from './history'

export interface ChartDataPoint {
  timestamp: string
  [key: string]: string | number | null
}

/**
 * Pivot poll cycle data into chart-friendly format.
 * Each data point = one poll cycle with all mapped values + derived values as keys.
 */
export async function pivotChartData(
  sessionId: string,
  seriesKeys: string[],
  limit = 200,
): Promise<ChartDataPoint[]> {
  // Fetch only the latest N cycles using bounded query
  const cycles = await getRecentCycles(sessionId, limit)
  // getRecentCycles returns newest-first; reverse for chronological chart order
  const recentCycles = cycles.reverse()

  // Convert to Set for O(1) lookups instead of array.includes
  const seriesKeysSet = new Set(seriesKeys)

  // Get all source results for these cycles
  const cycleIds = recentCycles.map((c) => c.id)

  // Get all sources for this session (for sourceKey → id mapping)
  const sources = await db.sources.where('sessionId').equals(sessionId).toArray()
  const sourceIdToKey = new Map(sources.map((s) => [s.id, s.key]))

  // Get field mappings (for mappingId → key mapping)
  const mappings = await db.fieldMappings
    .where('sourceId')
    .anyOf(sources.map((s) => s.id))
    .toArray()
  const mappingIdToKey = new Map(
    mappings.map((m) => {
      const sourceKey = sourceIdToKey.get(m.sourceId) ?? 'unknown'
      return [m.id, `${sourceKey}.${m.key}`]
    }),
  )

  // Get all source results
  const sourceResults =
    cycleIds.length > 0
      ? await db.sourceResults.where('cycleId').anyOf(cycleIds).toArray()
      : []

  const sourceResultIds = sourceResults.map((r) => r.id)

  // Get all mapped values
  const mappedValues =
    sourceResultIds.length > 0
      ? await db.mappedValues.where('sourceResultId').anyOf(sourceResultIds).toArray()
      : []

  // Get derived values (placeholder — slice 03)
  const derivedValues =
    cycleIds.length > 0
      ? await db.derivedValues.where('cycleId').anyOf(cycleIds).toArray()
      : []

  // Get derived metrics for key mapping
  const metrics = await db.derivedMetrics.where('sessionId').equals(sessionId).toArray()
  const metricIdToKey = new Map(metrics.map((m) => [m.id, m.key]))

  // Build map: cycleId → sourceResult[]
  const resultsByCycle = new Map<string, typeof sourceResults>()
  for (const r of sourceResults) {
    const arr = resultsByCycle.get(r.cycleId) ?? []
    arr.push(r)
    resultsByCycle.set(r.cycleId, arr)
  }

  // Build map: sourceResultId → mappedValue[]
  const valuesByResult = new Map<string, typeof mappedValues>()
  for (const v of mappedValues) {
    const arr = valuesByResult.get(v.sourceResultId) ?? []
    arr.push(v)
    valuesByResult.set(v.sourceResultId, arr)
  }

  // Build map: cycleId → derivedValue[]
  const derivedByCycle = new Map<string, typeof derivedValues>()
  for (const d of derivedValues) {
    const arr = derivedByCycle.get(d.cycleId) ?? []
    arr.push(d)
    derivedByCycle.set(d.cycleId, arr)
  }

  // Pivot into chart data points
  return recentCycles.map((cycle) => {
    const point: ChartDataPoint = {
      timestamp: cycle.timestamp,
    }

    // Add mapped values
    const cycleResults = resultsByCycle.get(cycle.id) ?? []
    for (const result of cycleResults) {
      const values = valuesByResult.get(result.id) ?? []
      for (const v of values) {
        const key = mappingIdToKey.get(v.mappingId)
        if (key && seriesKeysSet.has(key)) {
          point[key] = typeof v.value === 'number' ? v.value : null
        }
      }
    }

    // Add derived values
    const derived = derivedByCycle.get(cycle.id) ?? []
    for (const d of derived) {
      const key = metricIdToKey.get(d.metricId)
      if (key && seriesKeysSet.has(key)) {
        point[key] = d.value
      }
    }

    return point
  })
}
