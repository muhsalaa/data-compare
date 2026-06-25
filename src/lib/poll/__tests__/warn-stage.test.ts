import { describe, it, expect, beforeEach } from 'vitest'
import { db, newId, nowISO } from '@/db'
import { evaluateWarningRules, __resetWarningState } from '../warn-stage'

beforeEach(async () => {
  await db.delete()
  await db.open()
  __resetWarningState()
})

/**
 * Helper: seed a session, a derived metric, a warning rule, and a poll cycle
 * with a derived value. Returns the created IDs for assertions.
 * The first cycle ID is returned as `cycleId` — it has derived values.
 */
async function seedScenario(opts?: {
  ruleExpression?: string
  ruleSeverity?: 'info' | 'warning' | 'critical'
  derivedValue?: number | null
}) {
  const sessionId = newId()
  const metricId = newId()
  const ruleId = newId()
  const cycleId = newId()

  const expr = opts?.ruleExpression ?? 'roas < 1.2'
  const severity = opts?.ruleSeverity ?? 'warning'
  const dv = opts?.derivedValue ?? 1.0

  // Session
  await db.sessions.add({
    id: sessionId,
    name: 'Test',
    status: 'active',
    pollIntervalMs: 30000,
    timeoutMs: 15000,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  })

  // Derived metric
  await db.derivedMetrics.add({
    id: metricId,
    sessionId,
    label: 'ROAS',
    key: 'roas',
    formula: 'amount / spend',
  })

  // Warning rule
  await db.warningRules.add({
    id: ruleId,
    sessionId,
    name: 'Low ROAS',
    expression: expr,
    severity,
    enabled: true,
  })

  // First poll cycle + its derived value
  await db.pollCycles.add({ id: cycleId, sessionId, timestamp: nowISO() })
  await db.derivedValues.add({
    id: newId(),
    cycleId,
    metricId,
    value: dv,
    error: dv === null ? 'No data' : null,
  })

  return { sessionId, metricId, ruleId, cycleId }
}

describe('evaluateWarningRules — first evaluation silence', () => {
  it('writes zero warningEvents on first evaluation (state set silently)', async () => {
    const { sessionId, cycleId } = await seedScenario({ derivedValue: 1.0 })

    await evaluateWarningRules(sessionId, cycleId)

    const events = await db.warningEvents.toArray()
    expect(events).toHaveLength(0)
  })

  it('writes zero events when first evaluation has null derived value', async () => {
    const { sessionId, cycleId } = await seedScenario({ derivedValue: null })

    await evaluateWarningRules(sessionId, cycleId)

    const events = await db.warningEvents.toArray()
    expect(events).toHaveLength(0)
  })
})

describe('evaluateWarningRules — state transitions', () => {
  it('writes one event on warning→healthy transition', async () => {
    const { sessionId, ruleId, metricId, cycleId: c1 } = await seedScenario({
      ruleExpression: 'roas > 2', // triggered when roas > 2
      derivedValue: 3,           // 3 > 2 = true → state = warning
    })

    // First evaluation (silent) — state set to warning
    await evaluateWarningRules(sessionId, c1)

    // Second poll cycle: roas = 1 → expression false → healthy transition
    const c2 = newId()
    await db.pollCycles.add({ id: c2, sessionId, timestamp: nowISO() })
    await db.derivedValues.add({ id: newId(), cycleId: c2, metricId, value: 1, error: null })
    await evaluateWarningRules(sessionId, c2)

    const events = await db.warningEvents.toArray()
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.ruleId).toBe(ruleId)
    expect(ev.state).toBe('healthy')
    expect(ev.transition).toBe('warning→healthy')
  })

  it('writes one event on healthy→warning transition', async () => {
    const { sessionId, ruleId, metricId, cycleId: c1 } = await seedScenario({
      ruleExpression: 'roas > 2', // triggered when roas > 2
      derivedValue: 1,           // 1 > 2 = false → state = healthy
    })

    // First evaluation (silent) — state set to healthy
    await evaluateWarningRules(sessionId, c1)

    // Second poll cycle: roas = 3 → expression true → warning transition
    const c2 = newId()
    await db.pollCycles.add({ id: c2, sessionId, timestamp: nowISO() })
    await db.derivedValues.add({ id: newId(), cycleId: c2, metricId, value: 3, error: null })
    await evaluateWarningRules(sessionId, c2)

    const events = await db.warningEvents.toArray()
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.ruleId).toBe(ruleId)
    expect(ev.state).toBe('warning')
    expect(ev.transition).toBe('healthy→warning')
  })

  it('writes zero events when state stays the same across polls', async () => {
    const { sessionId, metricId, cycleId: c1 } = await seedScenario({
      ruleExpression: 'roas > 2', // triggered when roas > 2
      derivedValue: 3,           // 3 > 2 = true → state = warning
    })

    // First evaluation (silent)
    await evaluateWarningRules(sessionId, c1)

    // Second poll cycle: roas = 5 → still true → state unchanged
    const c2 = newId()
    await db.pollCycles.add({ id: c2, sessionId, timestamp: nowISO() })
    await db.derivedValues.add({ id: newId(), cycleId: c2, metricId, value: 5, error: null })
    await evaluateWarningRules(sessionId, c2)

    const events = await db.warningEvents.toArray()
    expect(events).toHaveLength(0)
  })

  it('writes critical severity event on healthy→critical transition', async () => {
    const { sessionId, metricId, cycleId: c1 } = await seedScenario({
      ruleExpression: 'roas > 2',
      ruleSeverity: 'critical',
      derivedValue: 1,           // 1 > 2 = false → state = healthy
    })

    // First evaluation (silent)
    await evaluateWarningRules(sessionId, c1)

    // Second cycle: roas = 3 → expression true → critical transition
    const c2 = newId()
    await db.pollCycles.add({ id: c2, sessionId, timestamp: nowISO() })
    await db.derivedValues.add({ id: newId(), cycleId: c2, metricId, value: 3, error: null })
    await evaluateWarningRules(sessionId, c2)

    const events = await db.warningEvents.toArray()
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.state).toBe('critical')
    expect(ev.transition).toBe('healthy→critical')
  })

  it('writes multiple events across multiple transitions', async () => {
    const { sessionId, metricId, cycleId: c1 } = await seedScenario({
      ruleExpression: 'roas > 2',
      derivedValue: 1,           // 1 > 2 = false → healthy
    })

    // First evaluation (silent)
    await evaluateWarningRules(sessionId, c1)

    // Second cycle: roas = 3 → true → warning transition
    const c2 = newId()
    await db.pollCycles.add({ id: c2, sessionId, timestamp: nowISO() })
    await db.derivedValues.add({ id: newId(), cycleId: c2, metricId, value: 3, error: null })
    await evaluateWarningRules(sessionId, c2)

    // Third cycle: roas = 1 → false → healthy transition
    const c3 = newId()
    await db.pollCycles.add({ id: c3, sessionId, timestamp: nowISO() })
    await db.derivedValues.add({ id: newId(), cycleId: c3, metricId, value: 1, error: null })
    await evaluateWarningRules(sessionId, c3)

    const events = await db.warningEvents.orderBy('timestamp').toArray()
    expect(events).toHaveLength(2)
    expect(events[0].transition).toBe('healthy→warning')
    expect(events[1].transition).toBe('warning→healthy')
  })
})
