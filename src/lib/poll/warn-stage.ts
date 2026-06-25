import { db, newId, nowISO } from '@/db'
import { evaluateWarning } from '@/lib/warning'

// Warning rule state machine — in-memory, resets on page reload
// Tracks previous state per ruleId.
// On first evaluation per rule, the state is set silently (no warning_events
// row written) to avoid false alarms on initial poll. Only state transitions
// produce events. The map resets on page reload; after reload, the next poll
// behaves like a fresh first evaluation, which is acceptable for MVP.
const warningState = new Map<string, 'healthy' | 'warning' | 'critical'>()

/**
 * Reset the warning state map — exported for test use only.
 * Resets the in-memory state machine so tests can simulate fresh sessions.
 */
export function __resetWarningState(): void {
  warningState.clear()
}

/**
 * Stage 4: Evaluate warning rules for a poll cycle.
 * Builds a scope from mapped values + derived values,
 * then evaluates each enabled rule and writes warning_events
 * on state transitions only.
 *
 * First evaluation sets state silently (no event). Later transitions
 * create warning_events. In-memory state resets on page reload.
 */
export async function evaluateWarningRules(sessionId: string, cycleId: string): Promise<void> {
  const rules = await db.warningRules.where('sessionId').equals(sessionId).toArray()
  if (rules.length === 0) return

  const sourceResults = await db.sourceResults.where('cycleId').equals(cycleId).toArray()
  const sourceResultIds = sourceResults.map((r) => r.id)

  const mappedValues =
    sourceResultIds.length > 0
      ? await db.mappedValues.where('sourceResultId').anyOf(sourceResultIds).toArray()
      : []

  const mappingIds = [...new Set(mappedValues.map((v) => v.mappingId))]
  const allMappings =
    mappingIds.length > 0
      ? await db.fieldMappings.where('id').anyOf(mappingIds).toArray()
      : []
  const mappingMap = new Map(allMappings.map((m) => [m.id, m]))

  const sourceIds = [...new Set(allMappings.map((m) => m.sourceId))]
  const allSources =
    sourceIds.length > 0
      ? await db.sources.where('id').anyOf(sourceIds).toArray()
      : []
  const sourceMap = new Map(allSources.map((s) => [s.id, s]))

  const scope: Record<string, number | null> = {}
  for (const mv of mappedValues) {
    const mapping = mappingMap.get(mv.mappingId)
    if (!mapping) continue
    const source = sourceMap.get(mapping.sourceId)
    if (!source) continue
    const scopeKey = `${source.key}.${mapping.key}`
    scope[scopeKey] = typeof mv.value === 'number' ? mv.value : null
  }

  // Add derived metrics to scope
  const derivedValues = await db.derivedValues.where('cycleId').equals(cycleId).toArray()
  const metricIds = [...new Set(derivedValues.map((d) => d.metricId))]
  const metrics =
    metricIds.length > 0
      ? await db.derivedMetrics.where('id').anyOf(metricIds).toArray()
      : []
  const metricMap = new Map(metrics.map((m) => [m.id, m]))

  for (const dv of derivedValues) {
    const metric = metricMap.get(dv.metricId)
    if (!metric) continue
    scope[metric.key] = dv.value
  }

  // Evaluate each rule
  for (const rule of rules) {
    if (!rule.enabled) continue

    const triggered = evaluateWarning(rule.expression, scope)
    const newState: 'healthy' | 'warning' | 'critical' = triggered
      ? rule.severity === 'critical'
        ? 'critical'
        : 'warning'
      : 'healthy'

    const prevState = warningState.get(rule.id)

    if (prevState === undefined) {
      // First evaluation — set state silently, no event written
      // Prevents false alarms on initial poll (see docs/glossary.md D7)
      warningState.set(rule.id, newState)
    } else if (prevState !== newState) {
      const transition = `${prevState}→${newState}`
      await db.warningEvents.add({
        id: newId(),
        cycleId,
        ruleId: rule.id,
        state: newState,
        transition,
        timestamp: nowISO(),
      })
      warningState.set(rule.id, newState)
    }
  }
}
