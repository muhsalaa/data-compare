import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import {
  findReferenceDependencies,
  propagateReferenceRenames,
  propagateSourceKeyRename,
  renameExactReferences,
  renameSourceScopedReferences,
} from '@/lib/source-key-rename'

describe('rename helpers', () => {
  it('renames only exact source-key references', () => {
    const expr = 'click.spend + click.clicks + roas + otherclick.spend + click_rate'

    expect(renameSourceScopedReferences(expr, 'click', 'pencet')).toBe(
      'pencet.spend + pencet.clicks + roas + otherclick.spend + click_rate',
    )
  })

  it('leaves unrelated expressions unchanged', () => {
    const expr = 'roas > 1 && spend_total > 100'
    expect(renameSourceScopedReferences(expr, 'click', 'pencet')).toBe(expr)
  })

  it('renames only exact full references', () => {
    const expr = 'ads.spend / ads.click + ads.click_rate + ads_click + other.ads.click'

    expect(renameExactReferences(expr, { 'ads.click': 'ads.pencet' })).toBe(
      'ads.spend / ads.pencet + ads.click_rate + ads_click + other.ads.click',
    )
  })
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('findReferenceDependencies', () => {
  it('finds dependent metrics, rules, and charts for exact references only', async () => {
    await db.derivedMetrics.bulkAdd([
      {
        id: 'metric-a',
        sessionId: 'session-1',
        label: 'CTR',
        key: 'ctr',
        formula: 'ads.click / ads.impressions',
      },
      {
        id: 'metric-b',
        sessionId: 'session-1',
        label: 'Noise',
        key: 'noise',
        formula: 'ads.click_rate + 1',
      },
    ])

    await db.warningRules.add({
      id: 'rule-a',
      sessionId: 'session-1',
      name: 'Clicks low',
      expression: 'ads.click < 10',
      severity: 'warning',
      enabled: true,
    })

    await db.charts.bulkAdd([
      {
        id: 'chart-a',
        sessionId: 'session-1',
        name: 'Clicks',
        series: ['ads.click', 'ctr'],
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'chart-b',
        sessionId: 'session-1',
        name: 'Other',
        series: ['ads.click_rate'],
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ])

    const result = await findReferenceDependencies('session-1', ['ads.click'])

    expect(result.metrics).toEqual([{ id: 'metric-a', label: 'CTR', reference: 'ads.click' }])
    expect(result.rules).toEqual([{ id: 'rule-a', name: 'Clicks low', reference: 'ads.click' }])
    expect(result.charts).toEqual([{ id: 'chart-a', name: 'Clicks', reference: 'ads.click' }])
  })
})

describe('propagateSourceKeyRename', () => {
  it('updates derived metrics, warning rules, and custom charts in the same session only', async () => {
    await db.derivedMetrics.bulkAdd([
      {
        id: 'metric-1',
        sessionId: 'session-1',
        label: 'ROAS',
        key: 'roas',
        formula: 'click.spend / click.clicks',
      },
      {
        id: 'metric-2',
        sessionId: 'session-2',
        label: 'Other',
        key: 'other',
        formula: 'click.spend / 2',
      },
    ])

    await db.warningRules.bulkAdd([
      {
        id: 'rule-1',
        sessionId: 'session-1',
        name: 'Low ROAS',
        expression: 'click.spend > 100 && roas < 1.2',
        severity: 'warning',
        enabled: true,
      },
      {
        id: 'rule-2',
        sessionId: 'session-1',
        name: 'Unrelated',
        expression: 'roas < 1.2',
        severity: 'info',
        enabled: true,
      },
    ])

    await db.charts.bulkAdd([
      {
        id: 'chart-1',
        sessionId: 'session-1',
        name: 'Main',
        series: ['click.spend', 'roas', 'click.clicks'],
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'chart-2',
        sessionId: 'session-2',
        name: 'Other session',
        series: ['click.spend'],
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ])

    const result = await propagateSourceKeyRename('session-1', 'click', 'pencet')

    expect(result).toEqual({ metricsUpdated: 1, rulesUpdated: 1, chartsUpdated: 1 })

    expect((await db.derivedMetrics.get('metric-1'))?.formula).toBe('pencet.spend / pencet.clicks')
    expect((await db.derivedMetrics.get('metric-2'))?.formula).toBe('click.spend / 2')

    expect((await db.warningRules.get('rule-1'))?.expression).toBe('pencet.spend > 100 && roas < 1.2')
    expect((await db.warningRules.get('rule-2'))?.expression).toBe('roas < 1.2')

    expect((await db.charts.get('chart-1'))?.series).toEqual(['pencet.spend', 'roas', 'pencet.clicks'])
    expect((await db.charts.get('chart-2'))?.series).toEqual(['click.spend'])
  })
})

describe('propagateReferenceRenames', () => {
  it('updates mapping key references in formulas, warnings, and charts', async () => {
    await db.derivedMetrics.add({
      id: 'metric-10',
      sessionId: 'session-1',
      label: 'CTR',
      key: 'ctr',
      formula: 'ads.click / ads.impressions',
    })

    await db.warningRules.add({
      id: 'rule-10',
      sessionId: 'session-1',
      name: 'Clicks low',
      expression: 'ads.click < 10 && ads.impressions > 100',
      severity: 'warning',
      enabled: true,
    })

    await db.charts.add({
      id: 'chart-10',
      sessionId: 'session-1',
      name: 'Clicks',
      series: ['ads.click', 'ctr'],
      createdAt: '2024-01-01T00:00:00.000Z',
    })

    const result = await propagateReferenceRenames('session-1', {
      'ads.click': 'ads.pencet',
    })

    expect(result).toEqual({ metricsUpdated: 1, rulesUpdated: 1, chartsUpdated: 1 })
    expect((await db.derivedMetrics.get('metric-10'))?.formula).toBe('ads.pencet / ads.impressions')
    expect((await db.warningRules.get('rule-10'))?.expression).toBe(
      'ads.pencet < 10 && ads.impressions > 100',
    )
    expect((await db.charts.get('chart-10'))?.series).toEqual(['ads.pencet', 'ctr'])
  })

  it('supports simultaneous source and mapping key renames', async () => {
    await db.derivedMetrics.add({
      id: 'metric-20',
      sessionId: 'session-1',
      label: 'CTR',
      key: 'ctr',
      formula: 'ads.click / ads.impressions',
    })

    const result = await propagateReferenceRenames('session-1', {
      'ads.click': 'pencet.pencet',
      'ads.impressions': 'pencet.tayang',
    })

    expect(result).toEqual({ metricsUpdated: 1, rulesUpdated: 0, chartsUpdated: 0 })
    expect((await db.derivedMetrics.get('metric-20'))?.formula).toBe('pencet.pencet / pencet.tayang')
  })
})
