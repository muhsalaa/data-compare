import { beforeEach, describe, expect, it } from 'vitest'
import { db, createSession, nowISO } from '@/db'
import { executeAction } from '@/lib/ai/actions'

describe('executeAction', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  async function seedSessionWithMapping() {
    const session = await createSession({ name: 'Test session' })
    await db.sources.add({
      id: 'src-ads',
      sessionId: session.id,
      key: 'ads',
      name: 'Ads API',
      type: 'http-poll',
      url: 'https://example.com/ads',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: nowISO(),
    })
    await db.fieldMappings.bulkAdd([
      {
        id: 'map-spend',
        sourceId: 'src-ads',
        label: 'Spend',
        key: 'spend',
        jsonPath: 'stats.spend',
        type: 'number',
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
    return session
  }

  describe('create_derived_metric', () => {
    it('creates a metric with a valid formula', async () => {
      const session = await seedSessionWithMapping()
      const result = await executeAction(session.id, {
        type: 'create_derived_metric',
        payload: { label: 'Cost Per Click', key: 'cpc', formula: 'ads.spend / ads.clicks' },
      })

      expect(result.ok).toBe(true)
      expect(result.createdIds).toHaveLength(1)

      const metrics = await db.derivedMetrics.where('sessionId').equals(session.id).toArray()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]?.label).toBe('Cost Per Click')
      expect(metrics[0]?.key).toBe('cpc')
    })

    it('rejects duplicate metric key', async () => {
      const session = await seedSessionWithMapping()
      await executeAction(session.id, {
        type: 'create_derived_metric',
        payload: { label: 'Cost Per Click', key: 'cpc', formula: 'ads.spend / ads.clicks' },
      })

      const result = await executeAction(session.id, {
        type: 'create_derived_metric',
        payload: { label: 'Other CPC', key: 'cpc', formula: 'ads.spend / ads.clicks' },
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('already exists')
    })

    it('rejects invalid formula', async () => {
      const session = await seedSessionWithMapping()
      const result = await executeAction(session.id, {
        type: 'create_derived_metric',
        payload: { label: 'Bad', key: 'bad', formula: 'ads.spend > 100' },
      })

      expect(result.ok).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('rejects formula referencing unknown variable', async () => {
      const session = await seedSessionWithMapping()
      const result = await executeAction(session.id, {
        type: 'create_derived_metric',
        payload: { label: 'Bad', key: 'bad', formula: 'ads.spend / unknown.field' },
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('unknown variables')
    })
  })

  describe('create_warning_rule', () => {
    it('creates a rule with a valid expression', async () => {
      const session = await seedSessionWithMapping()
      const result = await executeAction(session.id, {
        type: 'create_warning_rule',
        payload: { name: 'High spend', expression: 'ads.spend > 1000', severity: 'warning' },
      })

      expect(result.ok).toBe(true)
      const rules = await db.warningRules.where('sessionId').equals(session.id).toArray()
      expect(rules).toHaveLength(1)
      expect(rules[0]?.name).toBe('High spend')
      expect(rules[0]?.enabled).toBe(true)
    })

    it('rejects invalid expression', async () => {
      const session = await seedSessionWithMapping()
      const result = await executeAction(session.id, {
        type: 'create_warning_rule',
        payload: { name: 'Bad', expression: 'ads.spend + 1000', severity: 'warning' },
      })

      expect(result.ok).toBe(false)
      expect(result.error).toBeTruthy()
    })

    it('rejects expression referencing unknown variable', async () => {
      const session = await seedSessionWithMapping()
      const result = await executeAction(session.id, {
        type: 'create_warning_rule',
        payload: { name: 'Bad', expression: 'ads.spend / unknown.field > 1', severity: 'warning' },
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('unknown variables')
    })
  })

  describe('create_chart', () => {
    it('creates a chart with valid series', async () => {
      const session = await seedSessionWithMapping()
      const result = await executeAction(session.id, {
        type: 'create_chart',
        payload: { name: 'Spend Chart', series: ['ads.spend', 'ads.clicks'] },
      })

      expect(result.ok).toBe(true)
      const charts = await db.charts.where('sessionId').equals(session.id).toArray()
      expect(charts).toHaveLength(1)
      expect(charts[0]?.name).toBe('Spend Chart')
      expect(charts[0]?.series).toEqual(['ads.spend', 'ads.clicks'])
    })

    it('rejects chart with unknown series', async () => {
      const session = await seedSessionWithMapping()
      const result = await executeAction(session.id, {
        type: 'create_chart',
        payload: { name: 'Bad Chart', series: ['ads.unknown'] },
      })

      expect(result.ok).toBe(false)
      expect(result.error).toContain('unknown series')
    })
  })
})
