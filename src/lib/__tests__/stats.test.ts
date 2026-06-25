import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { computeStatCards } from '@/lib/stats'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('computeStatCards', () => {
  it('skips the newest cycle while it is still incomplete', async () => {
    await db.sessions.add({
      id: 'session-1',
      name: 'Session',
      status: 'active',
      pollIntervalMs: 1000,
      timeoutMs: 1000,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    await db.sources.add({
      id: 'source-1',
      sessionId: 'session-1',
      key: 'ads',
      name: 'Ads',
      type: 'http-poll',
      url: 'https://example.com',
      queryParams: [],
      authConfig: { type: 'none' },
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
    })

    await db.fieldMappings.add({
      id: 'mapping-1',
      sourceId: 'source-1',
      label: 'Spend',
      key: 'spend',
      jsonPath: '$.spend',
      type: 'number',
    })

    await db.pollCycles.bulkAdd([
      { id: 'cycle-1', sessionId: 'session-1', timestamp: '2024-01-01T00:00:00.000Z' },
      { id: 'cycle-2', sessionId: 'session-1', timestamp: '2024-01-01T00:01:00.000Z' },
      { id: 'cycle-3', sessionId: 'session-1', timestamp: '2024-01-01T00:02:00.000Z' },
    ])

    await db.sourceResults.bulkAdd([
      {
        id: 'result-1',
        cycleId: 'cycle-1',
        sourceId: 'source-1',
        success: true,
        rawJson: { spend: 100 },
        statusCode: 200,
        error: null,
        durationMs: 10,
      },
      {
        id: 'result-2',
        cycleId: 'cycle-2',
        sourceId: 'source-1',
        success: true,
        rawJson: { spend: 200 },
        statusCode: 200,
        error: null,
        durationMs: 10,
      },
    ])

    await db.mappedValues.bulkAdd([
      { id: 'value-1', sourceResultId: 'result-1', mappingId: 'mapping-1', value: 100 },
      { id: 'value-2', sourceResultId: 'result-2', mappingId: 'mapping-1', value: 200 },
    ])

    const cardsBefore = await computeStatCards(
      'session-1',
      await db.sources.toArray(),
      await db.fieldMappings.toArray(),
      [],
    )

    expect(cardsBefore).toHaveLength(1)
    expect(cardsBefore[0].latestValue).toBe(200)
    expect(cardsBefore[0].previousValue).toBe(100)

    await db.sourceResults.add({
      id: 'result-3',
      cycleId: 'cycle-3',
      sourceId: 'source-1',
      success: true,
      rawJson: { spend: 240 },
      statusCode: 200,
      error: null,
      durationMs: 10,
    })

    const cardsDuring = await computeStatCards(
      'session-1',
      await db.sources.toArray(),
      await db.fieldMappings.toArray(),
      [],
    )

    expect(cardsDuring[0].latestValue).toBe(200)
    expect(cardsDuring[0].previousValue).toBe(100)

    await db.mappedValues.add({
      id: 'value-3',
      sourceResultId: 'result-3',
      mappingId: 'mapping-1',
      value: 240,
    })

    const cardsAfter = await computeStatCards(
      'session-1',
      await db.sources.toArray(),
      await db.fieldMappings.toArray(),
      [],
    )

    expect(cardsAfter[0].latestValue).toBe(240)
    expect(cardsAfter[0].previousValue).toBe(200)
  })
})
