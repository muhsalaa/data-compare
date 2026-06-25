import { db, newId } from '@/db'
import { evaluateFormula } from '@/lib/formula'

/**
 * Stage 3: Evaluate derived metrics for a poll cycle.
 * Reads source_results and mapped_values for the cycle,
 * builds a scope of sourceKey.fieldKey → value,
 * then evaluates each derived metric and writes derived_values.
 */
export async function evaluateDerivedMetrics(sessionId: string, cycleId: string): Promise<void> {
  const metrics = await db.derivedMetrics.where('sessionId').equals(sessionId).toArray()
  if (metrics.length === 0) return

  // Build scope: collect all mapped values for this cycle
  const sourceResults = await db.sourceResults.where('cycleId').equals(cycleId).toArray()
  const sourceResultIds = sourceResults.map((r) => r.id)

  if (sourceResultIds.length === 0) return

  const mappedValues = await db.mappedValues
    .where('sourceResultId')
    .anyOf(sourceResultIds)
    .toArray()

  // Get mapping data to resolve sourceKey.fieldKey → value
  const mappingIds = [...new Set(mappedValues.map((v) => v.mappingId))]
  const allMappings = mappingIds.length > 0
    ? await db.fieldMappings.where('id').anyOf(mappingIds).toArray()
    : []
  const mappingMap = new Map(allMappings.map((m) => [m.id, m]))

  // Get sources for source key
  const sourceIds = [...new Set(allMappings.map((m) => m.sourceId))]
  const allSources = sourceIds.length > 0
    ? await db.sources.where('id').anyOf(sourceIds).toArray()
    : []
  const sourceMap = new Map(allSources.map((s) => [s.id, s]))

  // Build scope: { 'ads.spend': 100, 'crowdfunding.amount': 50, ... }
  const scope: Record<string, number | null> = {}
  for (const mv of mappedValues) {
    const mapping = mappingMap.get(mv.mappingId)
    if (!mapping) continue
    const source = sourceMap.get(mapping.sourceId)
    if (!source) continue
    const scopeKey = `${source.key}.${mapping.key}`
    scope[scopeKey] = typeof mv.value === 'number' ? mv.value : null
  }

  // Evaluate each metric
  for (const metric of metrics) {
    const value = evaluateFormula(metric.formula, scope)
    await db.derivedValues.add({
      id: newId(),
      cycleId,
      metricId: metric.id,
      value,
      error: value === null
        ? 'Evaluation returned null (missing data or division by zero)'
        : null,
    })
  }
}
