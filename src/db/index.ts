import Dexie, { type EntityTable } from 'dexie'
import { v4 as uuidv4 } from 'uuid'
import { assertValidSessionTiming, DEFAULT_POLL_INTERVAL_MS, DEFAULT_TIMEOUT_MS } from '@/lib/session-timing'
import { cascadeDelete } from './cascade'

// ── Type definitions ──────────────────────────────────────────────

export type SessionStatus = 'active' | 'paused' | 'stopped'
export type AuthType = 'none' | 'bearer' | 'header'
export type FieldType = 'string' | 'number' | 'boolean'
export type Scalar = string | number | boolean | null
export type WarningSeverity = 'info' | 'warning' | 'critical'
export type WarningState = 'healthy' | 'warning' | 'critical'

export interface Session {
  id: string
  name: string
  status: SessionStatus
  pollIntervalMs: number
  timeoutMs: number
  createdAt: string
  updatedAt: string
}

export interface Source {
  id: string
  sessionId: string
  key: string
  name: string
  type: string  // discriminator: 'http-poll' | 'websocket' | 'csv-upload' | 'sse'
  url: string
  queryParams: { key: string; value: string }[]
  authConfig: { type: AuthType; token?: string; headerName?: string; headerValue?: string }
  enabled: boolean
  createdAt: string
  lastTestFetchJson?: unknown
}

export interface FieldMapping {
  id: string
  sourceId: string
  label: string
  key: string
  jsonPath: string
  type: FieldType
  description?: string
}

export interface DerivedMetric {
  id: string
  sessionId: string
  label: string
  key: string
  formula: string
}

export interface Chart {
  id: string
  sessionId: string
  name: string
  series: string[]
  createdAt: string
}

export interface WarningRule {
  id: string
  sessionId: string
  name: string
  expression: string
  severity: WarningSeverity
  enabled: boolean
}

export interface PollCycle {
  id: string
  sessionId: string
  timestamp: string
}

export interface SourceResult {
  id: string
  cycleId: string
  sourceId: string
  success: boolean
  rawJson: unknown | null
  statusCode: number
  error: string | null
  durationMs: number
}

export interface MappedValue {
  id: string
  sourceResultId: string
  mappingId: string
  value: Scalar
}

export interface DerivedValue {
  id: string
  cycleId: string
  metricId: string
  value: number | null
  error: string | null
}

export interface WarningEvent {
  id: string
  cycleId: string
  ruleId: string
  state: WarningState
  transition: string
  timestamp: string
}

// ── Database ──────────────────────────────────────────────────────

export class DashboardDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>
  sources!: EntityTable<Source, 'id'>
  fieldMappings!: EntityTable<FieldMapping, 'id'>
  derivedMetrics!: EntityTable<DerivedMetric, 'id'>
  charts!: EntityTable<Chart, 'id'>
  warningRules!: EntityTable<WarningRule, 'id'>
  pollCycles!: EntityTable<PollCycle, 'id'>
  sourceResults!: EntityTable<SourceResult, 'id'>
  mappedValues!: EntityTable<MappedValue, 'id'>
  derivedValues!: EntityTable<DerivedValue, 'id'>
  warningEvents!: EntityTable<WarningEvent, 'id'>

  constructor() {
    super('DashboardDB')

    this.version(1).stores({
      sessions: 'id, status, updatedAt',
      sources: 'id, sessionId, [sessionId+key], type',
      fieldMappings: 'id, sourceId',
      derivedMetrics: 'id, sessionId',
      charts: 'id, sessionId',
      warningRules: 'id, sessionId',
      pollCycles: 'id, sessionId, [sessionId+timestamp]',
      sourceResults: 'id, cycleId, [sourceId+cycleId]',
      mappedValues: 'id, sourceResultId, [mappingId+sourceResultId]',
      derivedValues: 'id, cycleId, [metricId+cycleId]',
      warningEvents: 'id, cycleId, [ruleId+cycleId]',
    })

    this.version(2).stores({
      sessions: 'id, status, updatedAt',
      sources: 'id, sessionId, [sessionId+key], type',
      fieldMappings: 'id, sourceId',
      derivedMetrics: 'id, sessionId',
      charts: 'id, sessionId',
      warningRules: 'id, sessionId',
      pollCycles: 'id, sessionId, [sessionId+timestamp]',
      sourceResults: 'id, cycleId, [sourceId+cycleId]',
      mappedValues: 'id, sourceResultId, [mappingId+sourceResultId]',
      derivedValues: 'id, cycleId, [metricId+cycleId]',
      warningEvents: 'id, cycleId, timestamp, [ruleId+cycleId]',
    })
  }
}

export const db = new DashboardDB()

// ── Helpers ───────────────────────────────────────────────────────

export function newId(): string {
  return uuidv4()
}

export function nowISO(): string {
  return new Date().toISOString()
}

// ── Source key validation ─────────────────────────────────────────

/**
 * Check if a source key is available in a session.
 * Returns true if the key is not taken by another source.
 * When editing, pass the current source's id as excludeSourceId
 * so keeping the same key is allowed.
 */
export async function isSourceKeyAvailable(
  sessionId: string,
  key: string,
  excludeSourceId?: string,
): Promise<boolean> {
  const normalizedKey = key.trim().toLowerCase()
  const matches = await db.sources
    .where('[sessionId+key]')
    .equals([sessionId, normalizedKey])
    .toArray()

  if (matches.length === 0) return true
  if (excludeSourceId && matches.length === 1 && matches[0].id === excludeSourceId) return true
  return false
}

// ── Session operations ────────────────────────────────────────────

export async function createSession(data: {
  name: string
  pollIntervalMs?: number
  timeoutMs?: number
}): Promise<Session> {
  const pollIntervalMs = data.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const timeoutMs = data.timeoutMs ?? DEFAULT_TIMEOUT_MS
  assertValidSessionTiming({ pollIntervalMs, timeoutMs })

  const session: Session = {
    id: newId(),
    name: data.name,
    status: 'paused',
    pollIntervalMs,
    timeoutMs,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  await db.sessions.add(session)
  return session
}

export async function updateSessionDetails(
  id: string,
  data: {
    name: string
    pollIntervalMs: number
    timeoutMs: number
  },
): Promise<void> {
  assertValidSessionTiming(data)
  await db.sessions.update(id, {
    name: data.name,
    pollIntervalMs: data.pollIntervalMs,
    timeoutMs: data.timeoutMs,
    updatedAt: nowISO(),
  })
}

export async function updateSessionStatus(
  id: string,
  status: SessionStatus,
): Promise<void> {
  await db.sessions.update(id, { status, updatedAt: nowISO() })
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await cascadeDelete(db, 'sessions', [id])
  })
}
