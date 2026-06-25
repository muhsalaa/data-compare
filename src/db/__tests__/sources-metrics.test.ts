import { describe, it, expect, beforeEach } from 'vitest'
import { db, newId, isSourceKeyAvailable, type Source, type FieldMapping, type DerivedMetric } from '../index'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Source CRUD', () => {
  const sessionId = 'test-session-1'

  it('adds and reads a source', async () => {
    const source: Source = {
      id: newId(),
      sessionId,
      key: 'ads',
      name: 'Ad Campaign',
      type: 'http-poll',
      url: 'https://example.com/api',
      queryParams: [{ key: 'limit', value: '10' }],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: new Date().toISOString(),
    }

    await db.sources.add(source)
    const found = await db.sources.get(source.id)
    expect(found).toBeDefined()
    expect(found!.key).toBe('ads')
  })

  it('isSourceKeyAvailable detects duplicate in same session', async () => {
    const s1: Source = {
      id: newId(),
      sessionId,
      key: 'ads',
      name: 'Ads',
      type: 'http-poll',
      url: 'https://a.com',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: new Date().toISOString(),
    }
    await db.sources.add(s1)

    // Same key in same session should be unavailable
    const available = await isSourceKeyAvailable(sessionId, 'ads')
    expect(available).toBe(false)
  })

  it('isSourceKeyAvailable allows same key in different sessions', async () => {
    const s1: Source = {
      id: newId(),
      sessionId: 'sess-a',
      key: 'ads',
      name: 'Ads',
      type: 'http-poll',
      url: 'https://a.com',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: new Date().toISOString(),
    }
    await db.sources.add(s1)

    // Different session should still be available
    const available = await isSourceKeyAvailable('sess-b', 'ads')
    expect(available).toBe(true)
  })

  it('isSourceKeyAvailable with excludeSourceId allows same key for edit', async () => {
    const s1Id = newId()
    const s1: Source = {
      id: s1Id,
      sessionId,
      key: 'ads',
      name: 'Ads',
      type: 'http-poll',
      url: 'https://a.com',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: new Date().toISOString(),
    }
    await db.sources.add(s1)

    // Editing the same source with same key should be allowed
    const available = await isSourceKeyAvailable(sessionId, 'ads', s1Id)
    expect(available).toBe(true)
  })

  it('isSourceKeyAvailable with excludeSourceId rejects different source with same key', async () => {
    const s1Id = newId()
    const s1: Source = {
      id: s1Id,
      sessionId,
      key: 'ads',
      name: 'Ads',
      type: 'http-poll',
      url: 'https://a.com',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: new Date().toISOString(),
    }
    await db.sources.add(s1)

    // Editing a different source (different id) with same key should be rejected
    const otherId = newId()
    const available = await isSourceKeyAvailable(sessionId, 'ads', otherId)
    expect(available).toBe(false)
  })

  it('allows same key in different sessions', async () => {
    const s1: Source = {
      id: newId(),
      sessionId: 'sess-a',
      key: 'ads',
      name: 'Ads',
      type: 'http-poll',
      url: 'https://a.com',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: new Date().toISOString(),
    }
    const s2: Source = {
      id: newId(),
      sessionId: 'sess-b',
      key: 'ads',
      name: 'Ads',
      type: 'http-poll',
      url: 'https://b.com',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: new Date().toISOString(),
    }

    await db.sources.add(s1)
    await db.sources.add(s2) // should not throw
    const all = await db.sources.toArray()
    expect(all).toHaveLength(2)
  })
})

describe('Field Mappings', () => {
  it('maps fields to a source', async () => {
    const sourceId = newId()

    const m1: FieldMapping = {
      id: newId(),
      sourceId,
      label: 'Spend',
      key: 'spend',
      jsonPath: 'campaign.stats.spend',
      type: 'number',
    }
    const m2: FieldMapping = {
      id: newId(),
      sourceId,
      label: 'Clicks',
      key: 'clicks',
      jsonPath: 'campaign.stats.clicks',
      type: 'number',
    }

    await db.fieldMappings.bulkAdd([m1, m2])
    const found = await db.fieldMappings.where('sourceId').equals(sourceId).toArray()
    expect(found).toHaveLength(2)
    expect(found.map((m) => m.key).sort()).toEqual(['clicks', 'spend'])
  })
})

describe('Derived Metrics', () => {
  it('creates and reads a derived metric', async () => {
    const sessionId = newId()

    const metric: DerivedMetric = {
      id: newId(),
      sessionId,
      label: 'ROAS',
      key: 'roas',
      formula: 'crowdfunding.amount / ads.spend',
    }

    await db.derivedMetrics.add(metric)
    const found = await db.derivedMetrics.where('sessionId').equals(sessionId).toArray()
    expect(found).toHaveLength(1)
    expect(found[0].key).toBe('roas')
  })

  it('deletes a derived metric', async () => {
    const sessionId = newId()

    const metric: DerivedMetric = {
      id: newId(),
      sessionId,
      label: 'CPC',
      key: 'cpc',
      formula: 'ads.spend / ads.clicks',
    }

    await db.derivedMetrics.add(metric)
    await db.derivedMetrics.delete(metric.id)
    const found = await db.derivedMetrics.get(metric.id)
    expect(found).toBeUndefined()
  })
})
