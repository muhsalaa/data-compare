import { db, newId, nowISO, type WarningSeverity } from '@/db'
import { validateFormula, extractVariables } from '@/lib/formula'
import { validateWarning } from '@/lib/warning'
import type { ActionResult, CopilotAction } from '@/lib/ai/types'

interface SessionScope {
  mappingRefs: Set<string>
  metricKeys: Set<string>
}

async function loadSessionScope(sessionId: string): Promise<SessionScope> {
  const sources = await db.sources.where('sessionId').equals(sessionId).toArray()
  const sourceIds = sources.map((source) => source.id)
  const mappings = sourceIds.length > 0
    ? await db.fieldMappings.where('sourceId').anyOf(sourceIds).toArray()
    : []
  const metrics = await db.derivedMetrics.where('sessionId').equals(sessionId).toArray()

  const mappingRefs = new Set(
    mappings.map((mapping) => {
      const source = sources.find((s) => s.id === mapping.sourceId)
      return `${source?.key ?? 'unknown'}.${mapping.key}`
    }),
  )
  const metricKeys = new Set(metrics.map((metric) => metric.key))

  return { mappingRefs, metricKeys }
}

function isValidMetricKey(key: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(key)
}

function unknownVariables(
  expression: string,
  scope: SessionScope,
): string[] {
  const vars = extractVariables(expression)
  const unknown: string[] = []
  for (const variable of vars) {
    if (scope.mappingRefs.has(variable) || scope.metricKeys.has(variable)) continue
    unknown.push(variable)
  }
  return unknown
}

export async function executeAction(
  sessionId: string,
  action: CopilotAction,
): Promise<ActionResult> {
  const scope = await loadSessionScope(sessionId)

  switch (action.type) {
    case 'create_derived_metric': {
      const { label, key, formula } = action.payload as {
        label: string
        key: string
        formula: string
      }

      if (!label.trim()) {
        return { ok: false, action, error: 'Metric label is required' }
      }
      if (!key.trim()) {
        return { ok: false, action, error: 'Metric key is required' }
      }
      if (!isValidMetricKey(key.trim())) {
        return { ok: false, action, error: 'Metric key must be lowercase letters, numbers, underscore, and cannot start with a number.' }
      }

      const existing = await db.derivedMetrics.where('sessionId').equals(sessionId).and((m) => m.key === key.trim()).first()
      if (existing) {
        return { ok: false, action, error: `Derived metric key "${key.trim()}" already exists in this session.` }
      }

      const formulaError = validateFormula(formula)
      if (formulaError) {
        return { ok: false, action, error: formulaError }
      }

      const unknown = unknownVariables(formula, scope)
      if (unknown.length > 0) {
        return { ok: false, action, error: `Formula references unknown variables: ${unknown.join(', ')}` }
      }

      const id = newId()
      await db.derivedMetrics.add({
        id,
        sessionId,
        label: label.trim(),
        key: key.trim(),
        formula: formula.trim(),
      })

      return { ok: true, action, createdIds: [id] }
    }

    case 'create_warning_rule': {
      const { name, expression, severity, enabled } = action.payload as {
        name: string
        expression: string
        severity: WarningSeverity
        enabled?: boolean
      }

      if (!name.trim()) {
        return { ok: false, action, error: 'Rule name is required' }
      }
      if (!expression.trim()) {
        return { ok: false, action, error: 'Rule expression is required' }
      }
      if (!['info', 'warning', 'critical'].includes(severity)) {
        return { ok: false, action, error: 'Severity must be info, warning, or critical' }
      }

      const expressionError = validateWarning(expression)
      if (expressionError) {
        return { ok: false, action, error: expressionError }
      }

      const unknown = unknownVariables(expression, scope)
      if (unknown.length > 0) {
        return { ok: false, action, error: `Expression references unknown variables: ${unknown.join(', ')}` }
      }

      const id = newId()
      await db.warningRules.add({
        id,
        sessionId,
        name: name.trim(),
        expression: expression.trim(),
        severity,
        enabled: enabled ?? true,
      })

      return { ok: true, action, createdIds: [id] }
    }

    case 'create_chart': {
      const { name, series } = action.payload as {
        name: string
        series: string[]
      }

      if (!name.trim()) {
        return { ok: false, action, error: 'Chart name is required' }
      }
      if (!Array.isArray(series) || series.length === 0) {
        return { ok: false, action, error: 'Chart must include at least one series' }
      }

      const unknown: string[] = []
      for (const ref of series) {
        if (scope.mappingRefs.has(ref) || scope.metricKeys.has(ref)) continue
        unknown.push(ref)
      }
      if (unknown.length > 0) {
        return { ok: false, action, error: `Chart references unknown series: ${unknown.join(', ')}` }
      }

      const id = newId()
      await db.charts.add({
        id,
        sessionId,
        name: name.trim(),
        series: series.map((s) => s.trim()),
        createdAt: nowISO(),
      })

      return { ok: true, action, createdIds: [id] }
    }

    default: {
      return { ok: false, action, error: 'Unsupported action type' }
    }
  }
}
