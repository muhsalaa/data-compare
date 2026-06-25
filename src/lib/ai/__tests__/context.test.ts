import { beforeEach, describe, expect, it } from 'vitest'
import { db, createSession } from '@/db'
import {
  buildCurrentSnapshot,
  buildDeepEvidence,
  buildDefaultSessionContext,
  buildRecentHistorySummary,
  buildSessionBrief,
} from '@/lib/ai/context'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function seedSessionFixture() {
  const session = await createSession({
    name: 'Campaign Watch',
    description: 'Track ad spend vs donations and catch bad ROAS swings.',
  })

  await db.sources.add({
    id: 'src-ads',
    sessionId: session.id,
    key: 'ads',
    name: 'Ads API',
    type: 'http-poll',
    url: 'https://api.example.com/ads',
    queryParams: [],
    authConfig: { type: 'none' },
    enabled: true,
    createdAt: new Date().toISOString(),
  })

  await db.fieldMappings.bulkAdd([
    {
      id: 'map-spend',
      sourceId: 'src-ads',
      label: 'Spend',
      key: 'spend',
      jsonPath: 'stats.spend',
      type: 'number',
      description: 'Total ad spend for the period.',
    },
    {
      id: 'map-clicks',
      sourceId: 'src-ads',
      label: 'Clicks',
      key: 'clicks',
      jsonPath: 'stats.clicks',
      type: 'number',
    },
  ])

  await db.derivedMetrics.add({
    id: 'metric-roas',
    sessionId: session.id,
    label: 'ROAS',
    key: 'roas',
    formula: 'donations / ads.spend',
  })

  await db.warningRules.add({
    id: 'rule-roas',
    sessionId: session.id,
    name: 'Low ROAS',
    expression: 'roas < 1.2',
    severity: 'warning',
    enabled: true,
  })

  for (let index = 0; index < 10; index += 1) {
    const cycleId = `cycle-${index}`
    const timestamp = new Date(Date.UTC(2026, 0, 1, 0, index, 0)).toISOString()
    await db.pollCycles.add({
      id: cycleId,
      sessionId: session.id,
      timestamp,
    })

    const sourceResultId = `result-${index}`
    const failed = index === 9
    await db.sourceResults.add({
      id: sourceResultId,
      cycleId,
      sourceId: 'src-ads',
      success: !failed,
      rawJson: failed
        ? { error: 'rate limited', body: 'x'.repeat(600) }
        : { stats: { spend: 100 + index * 5, clicks: 10 + index } },
      statusCode: failed ? 429 : 200,
      error: failed ? 'rate limited' : null,
      durationMs: 120 + index,
    })

    await db.mappedValues.bulkAdd([
      {
        id: `mapped-spend-${index}`,
        sourceResultId,
        mappingId: 'map-spend',
        value: 100 + index * 5,
      },
      {
        id: `mapped-clicks-${index}`,
        sourceResultId,
        mappingId: 'map-clicks',
        value: 10 + index,
      },
    ])

    await db.derivedValues.add({
      id: `derived-${index}`,
      cycleId,
      metricId: 'metric-roas',
      value: failed ? null : 1.8 - index * 0.1,
      error: failed ? 'missing donation input' : null,
    })
  }

  await db.warningEvents.bulkAdd([
    {
      id: 'warn-1',
      cycleId: 'cycle-8',
      ruleId: 'rule-roas',
      state: 'warning',
      transition: 'healthy→warning',
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 8, 10)).toISOString(),
    },
    {
      id: 'warn-2',
      cycleId: 'cycle-9',
      ruleId: 'rule-roas',
      state: 'warning',
      transition: 'warning→warning',
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 9, 10)).toISOString(),
    },
  ])

  return session
}

describe('ai context builders', () => {
  it('builds a session brief with core config', async () => {
    const session = await seedSessionFixture()
    const brief = await buildSessionBrief(session.id)

    expect(brief.session.name).toBe('Campaign Watch')
    expect(brief.session.description).toContain('Track ad spend')
    expect(brief.sources[0]?.key).toBe('ads')
    expect(brief.mappings[0]?.description).toBe('Total ad spend for the period.')
    expect(brief.derivedMetrics[0]?.key).toBe('roas')
    expect(brief.warningRules[0]?.name).toBe('Low ROAS')
  })

  it('builds current snapshot with bounded raw excerpts and active warnings', async () => {
    const session = await seedSessionFixture()
    const snapshot = await buildCurrentSnapshot(session.id)

    expect(snapshot.latestCycleTimestamp).toBeTruthy()
    expect(snapshot.sourceResults[0]?.statusCode).toBe(429)
    expect(snapshot.sourceResults[0]?.rawExcerpt).toContain('rate limited')
    expect(snapshot.sourceResults[0]?.rawExcerpt?.length).toBeLessThan(320)
    expect(snapshot.activeWarnings[0]?.name).toBe('Low ROAS')
  })

  it('builds recent history with bounded cycles and series summaries', async () => {
    const session = await seedSessionFixture()
    const history = await buildRecentHistorySummary(session.id)

    expect(history.window.loadedCycles).toBe(8)
    expect(history.truncation.some((note) => note.area === 'recent cycles')).toBe(true)
    expect(history.series.some((item) => item.key === 'ads.spend')).toBe(true)
    expect(history.recentSourceFailures[0]?.sourceKey).toBe('ads')
  })

  it('builds deep evidence for a selected source', async () => {
    const session = await seedSessionFixture()
    const evidence = await buildDeepEvidence(session.id, { sourceKey: 'ads' })

    expect(evidence.results).toHaveLength(1)
    expect(evidence.results[0]?.sourceKey).toBe('ads')
    expect(evidence.results[0]?.rawExcerpt).toContain('rate limited')
  })

  it('builds the default layered context packet', async () => {
    const session = await seedSessionFixture()
    const packet = await buildDefaultSessionContext(session.id)

    expect(packet.sessionBrief.session.name).toBe('Campaign Watch')
    expect(packet.currentSnapshot.activeWarnings).toHaveLength(1)
    expect(packet.recentHistory.series.length).toBeGreaterThan(0)
  })
})
