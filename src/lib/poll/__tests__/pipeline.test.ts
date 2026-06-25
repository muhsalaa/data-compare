import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db, newId, nowISO } from '@/db'
import { fetchSources } from '../fetch-stage'
import { extractMappedValues } from '../map-stage'

// Mock testFetch to return known data per source
vi.mock('@/lib/api', () => ({
  testFetch: vi.fn((config: { url: string }) => {
    // Return different data based on URL so we can verify source isolation
    if (config.url.includes('ads')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        data: { campaign: { spend: 100, clicks: 10 } },
        durationMs: 10,
      })
    }
    if (config.url.includes('crowdfunding')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        data: { campaign: { amount: 500, backers: 25 } },
        durationMs: 10,
      })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      data: { value: 999 },
      durationMs: 10,
    })
  }),
}))

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('Poll Pipeline — Source Isolation', () => {
  it('each source gets its own mapped values from its own response', async () => {
    const sessionId = 'test-session'

    // Create 3 sources with different keys
    const source1 = { id: newId(), sessionId, key: 'ads', name: 'Ads', type: 'http-poll', url: 'https://api.example.com/ads', queryParams: [], authConfig: { type: 'none' as const }, enabled: true, createdAt: nowISO() }
    const source2 = { id: newId(), sessionId, key: 'crowdfunding', name: 'Crowdfunding', type: 'http-poll', url: 'https://api.example.com/crowdfunding', queryParams: [], authConfig: { type: 'none' as const }, enabled: true, createdAt: nowISO() }
    const source3 = { id: newId(), sessionId, key: 'other', name: 'Other', type: 'http-poll', url: 'https://api.example.com/other', queryParams: [], authConfig: { type: 'none' as const }, enabled: true, createdAt: nowISO() }
    await db.sources.bulkAdd([source1, source2, source3])

    // Create field mappings for each source
    // ads.spend and ads.clicks
    const m1 = { id: newId(), sourceId: source1.id, label: 'Spend', key: 'spend', jsonPath: 'campaign.spend', type: 'number' as const }
    const m2 = { id: newId(), sourceId: source1.id, label: 'Clicks', key: 'clicks', jsonPath: 'campaign.clicks', type: 'number' as const }
    // crowdfunding.amount and crowdfunding.backers
    const m3 = { id: newId(), sourceId: source2.id, label: 'Amount', key: 'amount', jsonPath: 'campaign.amount', type: 'number' as const }
    const m4 = { id: newId(), sourceId: source2.id, label: 'Backers', key: 'backers', jsonPath: 'campaign.backers', type: 'number' as const }
    // other.value
    const m5 = { id: newId(), sourceId: source3.id, label: 'Value', key: 'value', jsonPath: 'value', type: 'number' as const }
    await db.fieldMappings.bulkAdd([m1, m2, m3, m4, m5])

    const cycleId = newId()
    await db.pollCycles.add({ id: cycleId, sessionId, timestamp: nowISO() })

    // Run pipeline stages
    const fetchResults = await fetchSources([source1, source2, source3], cycleId, 5000)
    await extractMappedValues(fetchResults)

    // Read back mapped values
    const sourceResults = await db.sourceResults.where('cycleId').equals(cycleId).toArray()
    const sourceResultIds = sourceResults.map(r => r.id)
    const mappedValues = await db.mappedValues.where('sourceResultId').anyOf(sourceResultIds).toArray()

    // Debug output
    console.log('sourceResults:', sourceResults.map(r => ({ id: r.id, sourceId: r.sourceId, success: r.success })))
    console.log('mappedValues:', mappedValues.map(mv => ({ id: mv.id, sourceResultId: mv.sourceResultId, mappingId: mv.mappingId, value: mv.value })))

    // Verify: ads should have spend=100
    const adsResult = sourceResults.find(r => r.sourceId === source1.id)
    expect(adsResult).toBeDefined()
    const adsMappings = mappedValues.filter(mv => mv.sourceResultId === adsResult!.id)
    expect(adsMappings.length).toBe(2)
    const adsSpend = adsMappings.find(mv => mv.mappingId === m1.id)
    expect(adsSpend?.value).toBe(100)

    // Verify: crowdfunding should have amount=500
    const cfResult = sourceResults.find(r => r.sourceId === source2.id)
    expect(cfResult).toBeDefined()
    const cfMappings = mappedValues.filter(mv => mv.sourceResultId === cfResult!.id)
    expect(cfMappings.length).toBe(2)
    const cfAmount = cfMappings.find(mv => mv.mappingId === m3.id)
    expect(cfAmount?.value).toBe(500)

    // Verify: other should have value=999
    const otherResult = sourceResults.find(r => r.sourceId === source3.id)
    expect(otherResult).toBeDefined()
    const otherMappings = mappedValues.filter(mv => mv.sourceResultId === otherResult!.id)
    expect(otherMappings.length).toBe(1)
    expect(otherMappings[0].value).toBe(999)
  })
})
