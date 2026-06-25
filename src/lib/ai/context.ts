import { db, type SourceResult } from '@/db'
import { getRecentCycles } from '@/lib/history'
import { pivotChartData } from '@/lib/pivot'

const DEFAULT_LIMITS = {
  sources: 8,
  mappings: 16,
  derivedMetrics: 12,
  warningRules: 12,
  cycles: 8,
  series: 8,
  warningEvents: 8,
  rawExcerptChars: 280,
} as const

interface TruncationNote {
  area: string
  included: number
  total: number
  note: string
}

export interface SessionContextPacket {
  sessionBrief: Awaited<ReturnType<typeof buildSessionBrief>>
  currentSnapshot: Awaited<ReturnType<typeof buildCurrentSnapshot>>
  recentHistory: Awaited<ReturnType<typeof buildRecentHistorySummary>>
}

function addTruncationNote(notes: TruncationNote[], area: string, total: number, included: number) {
  if (total <= included) return
  notes.push({
    area,
    total,
    included,
    note: `${area} truncated: showing ${included} of ${total}`,
  })
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function excerptRawJson(value: unknown, maxChars: number = DEFAULT_LIMITS.rawExcerptChars): string | null {
  if (value === null || value === undefined) return null
  const text = safeStringify(value)
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}…`
}

function directionFromValues(latest: number | null, previous: number | null): 'up' | 'down' | 'flat' | 'missing' {
  if (latest === null || previous === null) return 'missing'
  if (latest > previous) return 'up'
  if (latest < previous) return 'down'
  return 'flat'
}

async function loadSessionParts(sessionId: string) {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')

  const sources = await db.sources.where('sessionId').equals(sessionId).toArray()
  const sourceIds = sources.map((source) => source.id)
  const [mappings, derivedMetrics, warningRules] = await Promise.all([
    sourceIds.length > 0 ? db.fieldMappings.where('sourceId').anyOf(sourceIds).toArray() : Promise.resolve([]),
    db.derivedMetrics.where('sessionId').equals(sessionId).toArray(),
    db.warningRules.where('sessionId').equals(sessionId).toArray(),
  ])

  return { session, sources, mappings, derivedMetrics, warningRules }
}

export async function buildSessionBrief(sessionId: string) {
  const { session, sources, mappings, derivedMetrics, warningRules } = await loadSessionParts(sessionId)
  const notes: TruncationNote[] = []

  addTruncationNote(notes, 'sources', sources.length, DEFAULT_LIMITS.sources)
  addTruncationNote(notes, 'mappings', mappings.length, DEFAULT_LIMITS.mappings)
  addTruncationNote(notes, 'derived metrics', derivedMetrics.length, DEFAULT_LIMITS.derivedMetrics)
  addTruncationNote(notes, 'warning rules', warningRules.length, DEFAULT_LIMITS.warningRules)

  return {
    session: {
      id: session.id,
      name: session.name,
      description: session.description ?? null,
      status: session.status,
      pollIntervalMs: session.pollIntervalMs,
      timeoutMs: session.timeoutMs,
    },
    sources: sources.slice(0, DEFAULT_LIMITS.sources).map((source) => ({
      key: source.key,
      name: source.name,
      enabled: source.enabled,
      type: source.type,
      url: source.url,
    })),
    mappings: mappings.slice(0, DEFAULT_LIMITS.mappings).map((mapping) => ({
      key: mapping.key,
      label: mapping.label,
      sourceId: mapping.sourceId,
      jsonPath: mapping.jsonPath,
      type: mapping.type,
      description: mapping.description ?? null,
    })),
    derivedMetrics: derivedMetrics.slice(0, DEFAULT_LIMITS.derivedMetrics).map((metric) => ({
      key: metric.key,
      label: metric.label,
      formula: metric.formula,
    })),
    warningRules: warningRules.slice(0, DEFAULT_LIMITS.warningRules).map((rule) => ({
      name: rule.name,
      expression: rule.expression,
      severity: rule.severity,
      enabled: rule.enabled,
    })),
    truncation: notes,
  }
}

export async function buildCurrentSnapshot(sessionId: string) {
  const { sources, mappings, derivedMetrics, warningRules } = await loadSessionParts(sessionId)
  const latestCycle = (await getRecentCycles(sessionId, 1))[0] ?? null
  if (!latestCycle) {
    return {
      latestCycleTimestamp: null,
      sourceResults: [],
      mappedValues: [],
      derivedValues: [],
      activeWarnings: [],
      truncation: [] as TruncationNote[],
    }
  }

  const sourceResults = await db.sourceResults.where('cycleId').equals(latestCycle.id).toArray()
  const sourceResultIds = sourceResults.map((result) => result.id)
  const [mappedValues, derivedValues, warningEvents] = await Promise.all([
    sourceResultIds.length > 0 ? db.mappedValues.where('sourceResultId').anyOf(sourceResultIds).toArray() : Promise.resolve([]),
    db.derivedValues.where('cycleId').equals(latestCycle.id).toArray(),
    db.warningEvents.orderBy('timestamp').reverse().limit(DEFAULT_LIMITS.warningEvents * 4).toArray(),
  ])

  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const mappingById = new Map(mappings.map((mapping) => [mapping.id, mapping]))
  const metricById = new Map(derivedMetrics.map((metric) => [metric.id, metric]))
  const ruleById = new Map(warningRules.map((rule) => [rule.id, rule]))
  const notes: TruncationNote[] = []

  const latestRuleState = new Map<string, (typeof warningEvents)[number]>()
  for (const event of warningEvents) {
    if (!latestRuleState.has(event.ruleId)) {
      latestRuleState.set(event.ruleId, event)
    }
  }

  const activeWarnings = Array.from(latestRuleState.values())
    .filter((event) => {
      const rule = ruleById.get(event.ruleId)
      return rule?.enabled && (event.state === 'warning' || event.state === 'critical')
    })
    .slice(0, DEFAULT_LIMITS.warningEvents)
    .map((event) => {
      const rule = ruleById.get(event.ruleId)
      return {
        name: rule?.name ?? 'Unknown rule',
        severity: rule?.severity ?? 'warning',
        state: event.state,
        transition: event.transition,
        timestamp: event.timestamp,
      }
    })

  addTruncationNote(notes, 'active warnings', latestRuleState.size, DEFAULT_LIMITS.warningEvents)

  return {
    latestCycleTimestamp: latestCycle.timestamp,
    sourceResults: sourceResults.slice(0, DEFAULT_LIMITS.sources).map((result) => {
      const source = sourceById.get(result.sourceId)
      return {
        sourceKey: source?.key ?? 'unknown',
        sourceName: source?.name ?? 'Unknown source',
        success: result.success,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        error: result.error,
        rawExcerpt: result.success ? null : excerptRawJson(result.rawJson),
      }
    }),
    mappedValues: mappedValues.slice(0, DEFAULT_LIMITS.mappings).map((value) => {
      const mapping = mappingById.get(value.mappingId)
      const sourceResult = sourceResults.find((result) => result.id === value.sourceResultId)
      const source = sourceResult ? sourceById.get(sourceResult.sourceId) : null
      return {
        key: `${source?.key ?? 'unknown'}.${mapping?.key ?? 'unknown'}`,
        label: mapping?.label ?? 'Unknown mapping',
        type: mapping?.type ?? 'string',
        description: mapping?.description ?? null,
        value: value.value,
      }
    }),
    derivedValues: derivedValues.slice(0, DEFAULT_LIMITS.derivedMetrics).map((value) => ({
      key: metricById.get(value.metricId)?.key ?? 'unknown',
      label: metricById.get(value.metricId)?.label ?? 'Unknown metric',
      value: value.value,
      error: value.error,
    })),
    activeWarnings,
    truncation: notes,
  }
}

export async function buildRecentHistorySummary(sessionId: string, options?: { cycleLimit?: number }) {
  const cycleLimit = options?.cycleLimit ?? DEFAULT_LIMITS.cycles
  const { sources, mappings, derivedMetrics } = await loadSessionParts(sessionId)
  const cycles = await getRecentCycles(sessionId, cycleLimit + 1)
  const selectedCycles = cycles.slice(0, cycleLimit)
  const notes: TruncationNote[] = []

  addTruncationNote(notes, 'recent cycles', cycles.length, cycleLimit)

  const numericMappingSeries = mappings
    .filter((mapping) => mapping.type === 'number')
    .map((mapping) => {
      const source = sources.find((item) => item.id === mapping.sourceId)
      return {
        key: `${source?.key ?? 'unknown'}.${mapping.key}`,
        label: mapping.label,
      }
    })
  const derivedSeries = derivedMetrics.map((metric) => ({ key: metric.key, label: metric.label }))
  const allSeries = [...numericMappingSeries, ...derivedSeries]
  const selectedSeries = allSeries.slice(0, DEFAULT_LIMITS.series)

  addTruncationNote(notes, 'history series', allSeries.length, DEFAULT_LIMITS.series)

  const chartData = selectedSeries.length > 0
    ? await pivotChartData(sessionId, selectedSeries.map((item) => item.key), cycleLimit)
    : []

  const series = selectedSeries.map((item) => {
    const values = chartData
      .map((point) => point[item.key])
      .filter((value): value is number => typeof value === 'number')
    const latest = values.at(-1) ?? null
    const previous = values.length > 1 ? values.at(-2) ?? null : null

    return {
      key: item.key,
      label: item.label,
      latest,
      previous,
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null,
      direction: directionFromValues(latest, previous),
    }
  })

  const recentWarningEvents = await db.warningEvents
    .orderBy('timestamp')
    .reverse()
    .limit(DEFAULT_LIMITS.warningEvents)
    .toArray()

  const cycleIds = selectedCycles.map((cycle) => cycle.id)
  const recentSourceFailures = cycleIds.length > 0
    ? (await db.sourceResults.where('cycleId').anyOf(cycleIds).toArray())
        .filter((result) => !result.success || !!result.error)
        .slice(0, DEFAULT_LIMITS.warningEvents)
        .map((result) => {
          const source = sources.find((item) => item.id === result.sourceId)
          return {
            sourceKey: source?.key ?? 'unknown',
            statusCode: result.statusCode,
            error: result.error,
            rawExcerpt: excerptRawJson(result.rawJson),
          }
        })
    : []

  return {
    window: {
      requestedCycles: cycleLimit,
      loadedCycles: selectedCycles.length,
      newestTimestamp: selectedCycles[0]?.timestamp ?? null,
      oldestTimestamp: selectedCycles.at(-1)?.timestamp ?? null,
    },
    series,
    recentWarningEvents: recentWarningEvents.map((event) => ({
      ruleId: event.ruleId,
      state: event.state,
      transition: event.transition,
      timestamp: event.timestamp,
    })),
    recentSourceFailures,
    truncation: notes,
  }
}

export async function buildDeepEvidence(sessionId: string, request?: {
  sourceKey?: string
  cycleId?: string
  latest?: boolean
  maxChars?: number
}) {
  const { sources } = await loadSessionParts(sessionId)
  const source = request?.sourceKey
    ? sources.find((item) => item.key === request.sourceKey)
    : null

  let results: SourceResult[] = []
  if (request?.cycleId) {
    results = await db.sourceResults.where('cycleId').equals(request.cycleId).toArray()
  } else if (request?.latest !== false) {
    const latestCycle = (await getRecentCycles(sessionId, 1))[0]
    results = latestCycle ? await db.sourceResults.where('cycleId').equals(latestCycle.id).toArray() : []
  }

  const filtered = source ? results.filter((result) => result.sourceId === source.id) : results

  return {
    sessionId,
    results: filtered.slice(0, DEFAULT_LIMITS.sources).map((result) => ({
      sourceKey: sources.find((item) => item.id === result.sourceId)?.key ?? 'unknown',
      success: result.success,
      statusCode: result.statusCode,
      error: result.error,
      durationMs: result.durationMs,
      rawExcerpt: excerptRawJson(result.rawJson, request?.maxChars ?? DEFAULT_LIMITS.rawExcerptChars),
    })),
  }
}

export async function buildDefaultSessionContext(sessionId: string): Promise<SessionContextPacket> {
  const [sessionBrief, currentSnapshot, recentHistory] = await Promise.all([
    buildSessionBrief(sessionId),
    buildCurrentSnapshot(sessionId),
    buildRecentHistorySummary(sessionId),
  ])

  return {
    sessionBrief,
    currentSnapshot,
    recentHistory,
  }
}
