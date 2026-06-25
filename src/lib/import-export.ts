import { db, type Session, type Source, type FieldMapping, type DerivedMetric, type Chart, type WarningRule } from '@/db'
import { validateSessionTiming } from '@/lib/session-timing'

export interface SessionExport {
  version: 1
  exportedAt: string
  session: {
    name: string
    pollIntervalMs: number
    timeoutMs: number
  }
  sources: {
    id: string
    name: string
    key: string
    url: string
    queryParams: { key: string; value: string }[]
    enabled: boolean
  }[]
  fieldMappings: {
    id: string
    sourceId: string
    label: string
    key: string
    jsonPath: string
    type: string
  }[]
  derivedMetrics: {
    id: string
    label: string
    key: string
    formula: string
  }[]
  charts: {
    id: string
    name: string
    series: string[]
  }[]
  warningRules: {
    id: string
    name: string
    expression: string
    severity: string
    enabled: boolean
  }[]
}

export async function exportSession(sessionId: string): Promise<SessionExport> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')

  const sources = await db.sources.where('sessionId').equals(sessionId).toArray()
  const mappings = await db.fieldMappings
    .where('sourceId')
    .anyOf(sources.map((s) => s.id))
    .toArray()
  const metrics = await db.derivedMetrics.where('sessionId').equals(sessionId).toArray()
  const charts = await db.charts.where('sessionId').equals(sessionId).toArray()
  const rules = await db.warningRules.where('sessionId').equals(sessionId).toArray()

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    session: {
      name: session.name,
      pollIntervalMs: session.pollIntervalMs,
      timeoutMs: session.timeoutMs,
    },
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      key: s.key,
      url: s.url,
      queryParams: s.queryParams,
      enabled: s.enabled,
    })),
    fieldMappings: mappings.map((m) => ({
      id: m.id,
      sourceId: m.sourceId,
      label: m.label,
      key: m.key,
      jsonPath: m.jsonPath,
      type: m.type,
    })),
    derivedMetrics: metrics.map((dm) => ({
      id: dm.id,
      label: dm.label,
      key: dm.key,
      formula: dm.formula,
    })),
    charts: charts.map((c) => ({
      id: c.id,
      name: c.name,
      series: c.series,
    })),
    warningRules: rules.map((r) => ({
      id: r.id,
      name: r.name,
      expression: r.expression,
      severity: r.severity,
      enabled: r.enabled,
    })),
  }
}

export function downloadExport(data: SessionExport, sessionName: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sessionName.replace(/\s+/g, '-').toLowerCase()}-export.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Validation helpers ───────────────────────────────────────────

const VALID_SOURCE_KEY = /^[a-z][a-z0-9_]*$/
const VALID_MAPPING_KEY = /^[a-zA-Z0-9_]+$/
const VALID_FIELD_TYPES = new Set(['string', 'number', 'boolean'])
const VALID_SEVERITIES = new Set(['info', 'warning', 'critical'])

interface ImportValidationError {
  message: string
}

function validationError(message: string): ImportValidationError {
  return { message }
}

function validateUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function validateQueryParams(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every(
    (p) =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as { key: unknown }).key === 'string' &&
      typeof (p as { value: unknown }).value === 'string',
  )
}

function validateSessionExport(data: unknown): ImportValidationError | null {
  if (typeof data !== 'object' || data === null) {
    return validationError('Export data must be a JSON object')
  }

  const d = data as Record<string, unknown>

  if (d.version !== 1) {
    return validationError('Unsupported export version')
  }

  // Validate session
  if (typeof d.session !== 'object' || d.session === null) {
    return validationError('Missing or invalid session')
  }
  const session = d.session as Record<string, unknown>
  if (typeof session.name !== 'string' || session.name.trim().length === 0) {
    return validationError('Session name must be a non-empty string')
  }
  if (typeof session.pollIntervalMs !== 'number' || typeof session.timeoutMs !== 'number') {
    return validationError('Session pollIntervalMs and timeoutMs must be numbers')
  }
  const timingError = validateSessionTiming({
    pollIntervalMs: session.pollIntervalMs,
    timeoutMs: session.timeoutMs,
  })
  if (timingError) {
    return validationError(timingError)
  }

  // Validate sources
  if (!Array.isArray(d.sources)) {
    return validationError('Sources must be an array')
  }
  if (d.sources.length === 0) {
    return validationError('At least one source is required')
  }

  const sourceKeys = new Set<string>()
  const sourceIds = new Set<string>()

  for (let i = 0; i < d.sources.length; i++) {
    const s = d.sources[i] as Record<string, unknown>

    if (typeof s.id !== 'string' || s.id.length === 0) {
      return validationError(`Source at index ${i}: id must be a non-empty string`)
    }
    if (sourceIds.has(s.id)) {
      return validationError(`Source at index ${i}: duplicate id "${s.id}"`)
    }
    sourceIds.add(s.id)

    if (typeof s.name !== 'string' || s.name.trim().length === 0) {
      return validationError(`Source at index ${i}: name must be a non-empty string`)
    }
    if (typeof s.key !== 'string' || !VALID_SOURCE_KEY.test(s.key)) {
      return validationError(`Source at index ${i}: invalid key "${s.key}". Must be lowercase, letters/numbers/underscore, no leading number`)
    }
    if (sourceKeys.has(s.key)) {
      return validationError(`Source at index ${i}: duplicate key "${s.key}" (keys must be unique within an import)`)
    }
    sourceKeys.add(s.key)

    if (typeof s.url !== 'string' || !validateUrl(s.url)) {
      return validationError(`Source at index ${i}: invalid URL "${s.url}"`)
    }
    if (!validateQueryParams(s.queryParams)) {
      return validationError(`Source at index ${i}: queryParams must be an array of {key, value} objects`)
    }
    if (typeof s.enabled !== 'boolean') {
      return validationError(`Source at index ${i}: enabled must be a boolean`)
    }
  }

  // Validate field mappings
  if (d.fieldMappings !== undefined) {
    if (!Array.isArray(d.fieldMappings)) {
      return validationError('fieldMappings must be an array')
    }

    for (let i = 0; i < d.fieldMappings.length; i++) {
      const m = d.fieldMappings[i] as Record<string, unknown>

      if (typeof m.id !== 'string' || m.id.length === 0) {
        return validationError(`Field mapping at index ${i}: id must be a non-empty string`)
      }
      if (typeof m.sourceId !== 'string' || !sourceIds.has(m.sourceId)) {
        return validationError(`Field mapping at index ${i}: sourceId "${m.sourceId}" does not match any source in this import`)
      }
      if (typeof m.label !== 'string' || m.label.trim().length === 0) {
        return validationError(`Field mapping at index ${i}: label must be a non-empty string`)
      }
      if (typeof m.key !== 'string' || !VALID_MAPPING_KEY.test(m.key)) {
        return validationError(`Field mapping at index ${i}: invalid key "${m.key}"`)
      }
      if (typeof m.jsonPath !== 'string' || m.jsonPath.length === 0) {
        return validationError(`Field mapping at index ${i}: jsonPath must be a non-empty string`)
      }
      if (!VALID_FIELD_TYPES.has(m.type as string)) {
        return validationError(`Field mapping at index ${i}: invalid type "${m.type}". Must be one of: string, number, boolean`)
      }
    }
  }

  // Validate derived metrics
  if (d.derivedMetrics !== undefined) {
    if (!Array.isArray(d.derivedMetrics)) {
      return validationError('derivedMetrics must be an array')
    }

    for (let i = 0; i < d.derivedMetrics.length; i++) {
      const dm = d.derivedMetrics[i] as Record<string, unknown>

      if (typeof dm.label !== 'string' || dm.label.trim().length === 0) {
        return validationError(`Derived metric at index ${i}: label must be a non-empty string`)
      }
      if (typeof dm.key !== 'string' || dm.key.trim().length === 0) {
        return validationError(`Derived metric at index ${i}: key must be a non-empty string`)
      }
      if (typeof dm.formula !== 'string' || dm.formula.trim().length === 0) {
        return validationError(`Derived metric at index ${i}: formula must be a non-empty string`)
      }
    }
  }

  // Validate charts
  if (d.charts !== undefined) {
    if (!Array.isArray(d.charts)) {
      return validationError('charts must be an array')
    }

    for (let i = 0; i < d.charts.length; i++) {
      const c = d.charts[i] as Record<string, unknown>

      if (typeof c.name !== 'string' || c.name.trim().length === 0) {
        return validationError(`Chart at index ${i}: name must be a non-empty string`)
      }
      if (!Array.isArray(c.series) || !c.series.every((s: unknown) => typeof s === 'string')) {
        return validationError(`Chart at index ${i}: series must be an array of strings`)
      }
    }
  }

  // Validate warning rules
  if (d.warningRules !== undefined) {
    if (!Array.isArray(d.warningRules)) {
      return validationError('warningRules must be an array')
    }

    for (let i = 0; i < d.warningRules.length; i++) {
      const r = d.warningRules[i] as Record<string, unknown>

      if (typeof r.name !== 'string' || r.name.trim().length === 0) {
        return validationError(`Warning rule at index ${i}: name must be a non-empty string`)
      }
      if (typeof r.expression !== 'string' || r.expression.trim().length === 0) {
        return validationError(`Warning rule at index ${i}: expression must be a non-empty string`)
      }
      if (!VALID_SEVERITIES.has(r.severity as string)) {
        return validationError(`Warning rule at index ${i}: invalid severity "${r.severity}". Must be one of: info, warning, critical`)
      }
      if (typeof r.enabled !== 'boolean') {
        return validationError(`Warning rule at index ${i}: enabled must be a boolean`)
      }
    }
  }

  return null
}

// ── Import ────────────────────────────────────────────────────────

export async function importSession(file: File): Promise<string> {
  const text = await file.text()
  let data: unknown

  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON file')
  }

  // Validate the full import before any write
  const validationError = validateSessionExport(data)
  if (validationError) {
    throw new Error(`Invalid export format: ${validationError.message}`)
  }

  const importData = data as SessionExport

  // Generate new IDs before transaction
  const newSessionId = crypto.randomUUID()
  const idMap = new Map<string, string>()

  // Pre-compute new IDs for all sources
  for (const s of importData.sources) {
    const newId = crypto.randomUUID()
    idMap.set(s.id, newId)
  }

  // Wrap all writes in a single transaction
  await db.transaction(
    'rw',
    [
      db.sessions,
      db.sources,
      db.fieldMappings,
      db.derivedMetrics,
      db.charts,
      db.warningRules,
    ] as const,
    async () => {
      // Create session
      const session: Session = {
        id: newSessionId,
        name: importData.session.name,
        status: 'paused',
        pollIntervalMs: importData.session.pollIntervalMs,
        timeoutMs: importData.session.timeoutMs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await db.sessions.add(session)

      // Create sources
      for (const s of importData.sources) {
        const newSourceId = idMap.get(s.id)!
        const source: Source = {
          id: newSourceId,
          sessionId: newSessionId,
          key: s.key,
          name: s.name,
          type: 'http-poll',
          url: s.url,
          queryParams: s.queryParams,
          authConfig: { type: 'none' }, // Secrets stripped on export
          enabled: s.enabled,
          createdAt: new Date().toISOString(),
        }
        await db.sources.add(source)
      }

      // Create field mappings
      for (const m of importData.fieldMappings ?? []) {
        const newSourceId = idMap.get(m.sourceId)
        if (!newSourceId) continue

        const mapping: FieldMapping = {
          id: crypto.randomUUID(),
          sourceId: newSourceId,
          label: m.label,
          key: m.key,
          jsonPath: m.jsonPath,
          type: m.type as FieldMapping['type'],
        }
        await db.fieldMappings.add(mapping)
      }

      // Create derived metrics
      for (const dm of importData.derivedMetrics ?? []) {
        const metric: DerivedMetric = {
          id: crypto.randomUUID(),
          sessionId: newSessionId,
          label: dm.label,
          key: dm.key,
          formula: dm.formula,
        }
        await db.derivedMetrics.add(metric)
      }

      // Create charts
      for (const c of importData.charts ?? []) {
        const chart: Chart = {
          id: crypto.randomUUID(),
          sessionId: newSessionId,
          name: c.name,
          series: c.series,
          createdAt: new Date().toISOString(),
        }
        await db.charts.add(chart)
      }

      // Create warning rules
      for (const r of importData.warningRules ?? []) {
        const rule: WarningRule = {
          id: crypto.randomUUID(),
          sessionId: newSessionId,
          name: r.name,
          expression: r.expression,
          severity: r.severity as WarningRule['severity'],
          enabled: r.enabled,
        }
        await db.warningRules.add(rule)
      }
    },
  )

  return newSessionId
}
