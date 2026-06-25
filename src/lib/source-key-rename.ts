import { db } from '@/db'

const IDENTIFIER_REGEX = /[a-zA-Z_][a-zA-Z0-9_.]*/g

function extractExactReferences(expression: string): Set<string> {
  return new Set(expression.match(IDENTIFIER_REGEX) ?? [])
}

export function renameSourceScopedReferences(
  expression: string,
  oldSourceKey: string,
  newSourceKey: string,
): string {
  if (!expression || oldSourceKey === newSourceKey) return expression

  const oldPrefix = `${oldSourceKey}.`

  return expression.replace(IDENTIFIER_REGEX, (token) => {
    if (!token.startsWith(oldPrefix)) return token
    return `${newSourceKey}${token.slice(oldSourceKey.length)}`
  })
}

export function renameExactReferences(
  expression: string,
  replacements: Record<string, string> | Map<string, string>,
): string {
  if (!expression) return expression

  const map = replacements instanceof Map ? replacements : new Map(Object.entries(replacements))
  if (map.size === 0) return expression

  return expression.replace(IDENTIFIER_REGEX, (token) => map.get(token) ?? token)
}

export async function findReferenceDependencies(
  sessionId: string,
  references: string[],
): Promise<{
  metrics: Array<{ id: string; label: string; reference: string }>
  rules: Array<{ id: string; name: string; reference: string }>
  charts: Array<{ id: string; name: string; reference: string }>
}> {
  const wanted = new Set(references)
  if (wanted.size === 0) {
    return { metrics: [], rules: [], charts: [] }
  }

  const [metrics, rules, charts] = await Promise.all([
    db.derivedMetrics.where('sessionId').equals(sessionId).toArray(),
    db.warningRules.where('sessionId').equals(sessionId).toArray(),
    db.charts.where('sessionId').equals(sessionId).toArray(),
  ])

  const metricDeps = metrics.flatMap((metric) => {
    const refs = extractExactReferences(metric.formula)
    const reference = [...wanted].find((item) => refs.has(item))
    return reference ? [{ id: metric.id, label: metric.label, reference }] : []
  })

  const ruleDeps = rules.flatMap((rule) => {
    const refs = extractExactReferences(rule.expression)
    const reference = [...wanted].find((item) => refs.has(item))
    return reference ? [{ id: rule.id, name: rule.name, reference }] : []
  })

  const chartDeps = charts.flatMap((chart) => {
    const reference = chart.series.find((item) => wanted.has(item))
    return reference ? [{ id: chart.id, name: chart.name, reference }] : []
  })

  return { metrics: metricDeps, rules: ruleDeps, charts: chartDeps }
}

export async function propagateReferenceRenames(
  sessionId: string,
  replacements: Record<string, string> | Map<string, string>,
): Promise<{ metricsUpdated: number; rulesUpdated: number; chartsUpdated: number }> {
  const map = replacements instanceof Map ? replacements : new Map(Object.entries(replacements))
  if (map.size === 0) {
    return { metricsUpdated: 0, rulesUpdated: 0, chartsUpdated: 0 }
  }

  const [metrics, rules, charts] = await Promise.all([
    db.derivedMetrics.where('sessionId').equals(sessionId).toArray(),
    db.warningRules.where('sessionId').equals(sessionId).toArray(),
    db.charts.where('sessionId').equals(sessionId).toArray(),
  ])

  let metricsUpdated = 0
  for (const metric of metrics) {
    const formula = renameExactReferences(metric.formula, map)
    if (formula === metric.formula) continue
    await db.derivedMetrics.update(metric.id, { formula })
    metricsUpdated += 1
  }

  let rulesUpdated = 0
  for (const rule of rules) {
    const expression = renameExactReferences(rule.expression, map)
    if (expression === rule.expression) continue
    await db.warningRules.update(rule.id, { expression })
    rulesUpdated += 1
  }

  let chartsUpdated = 0
  for (const chart of charts) {
    const series = chart.series.map((item) => map.get(item) ?? item)
    const changed = series.some((item, index) => item !== chart.series[index])
    if (!changed) continue
    await db.charts.update(chart.id, { series })
    chartsUpdated += 1
  }

  return { metricsUpdated, rulesUpdated, chartsUpdated }
}

export async function propagateSourceKeyRename(
  sessionId: string,
  oldSourceKey: string,
  newSourceKey: string,
): Promise<{ metricsUpdated: number; rulesUpdated: number; chartsUpdated: number }> {
  if (oldSourceKey === newSourceKey) {
    return { metricsUpdated: 0, rulesUpdated: 0, chartsUpdated: 0 }
  }

  const [metrics, rules, charts] = await Promise.all([
    db.derivedMetrics.where('sessionId').equals(sessionId).toArray(),
    db.warningRules.where('sessionId').equals(sessionId).toArray(),
    db.charts.where('sessionId').equals(sessionId).toArray(),
  ])

  let metricsUpdated = 0
  for (const metric of metrics) {
    const formula = renameSourceScopedReferences(metric.formula, oldSourceKey, newSourceKey)
    if (formula === metric.formula) continue
    await db.derivedMetrics.update(metric.id, { formula })
    metricsUpdated += 1
  }

  let rulesUpdated = 0
  for (const rule of rules) {
    const expression = renameSourceScopedReferences(rule.expression, oldSourceKey, newSourceKey)
    if (expression === rule.expression) continue
    await db.warningRules.update(rule.id, { expression })
    rulesUpdated += 1
  }

  let chartsUpdated = 0
  for (const chart of charts) {
    const series = chart.series.map((item) => {
      if (!item.startsWith(`${oldSourceKey}.`)) return item
      return `${newSourceKey}${item.slice(oldSourceKey.length)}`
    })
    const changed = series.some((item, index) => item !== chart.series[index])
    if (!changed) continue
    await db.charts.update(chart.id, { series })
    chartsUpdated += 1
  }

  return { metricsUpdated, rulesUpdated, chartsUpdated }
}
