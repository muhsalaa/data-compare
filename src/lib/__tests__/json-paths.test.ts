import { describe, it, expect } from 'vitest'
import { extractScalarPaths, getByPath } from '../json-paths'

describe('extractScalarPaths', () => {
  it('extracts flat scalar fields', () => {
    const data = { name: 'Test', count: 42, active: true, empty: null }
    const paths = extractScalarPaths(data)

    expect(paths).toHaveLength(4)
    expect(paths).toContainEqual({ path: 'name', value: 'Test', type: 'string' })
    expect(paths).toContainEqual({ path: 'count', value: 42, type: 'number' })
    expect(paths).toContainEqual({ path: 'active', value: true, type: 'boolean' })
    expect(paths).toContainEqual({ path: 'empty', value: null, type: 'null' })
  })

  it('extracts nested scalar fields with dot notation', () => {
    const data = { campaign: { stats: { spend: 100, clicks: 50 }, name: 'Q1' } }
    const paths = extractScalarPaths(data)

    expect(paths).toHaveLength(3)
    expect(paths).toContainEqual({
      path: 'campaign.stats.spend',
      value: 100,
      type: 'number',
    })
    expect(paths).toContainEqual({
      path: 'campaign.stats.clicks',
      value: 50,
      type: 'number',
    })
    expect(paths).toContainEqual({
      path: 'campaign.name',
      value: 'Q1',
      type: 'string',
    })
  })

  it('skips arrays (MVP)', () => {
    const data = { items: [1, 2, 3], name: 'list' }
    const paths = extractScalarPaths(data)

    expect(paths).toHaveLength(1)
    expect(paths[0].path).toBe('name')
  })

  it('handles root-level scalar', () => {
    expect(extractScalarPaths(42)).toEqual([
      { path: '(root)', value: 42, type: 'number' },
    ])
    expect(extractScalarPaths(null)).toEqual([
      { path: '(root)', value: null, type: 'null' },
    ])
  })

  it('handles empty object', () => {
    expect(extractScalarPaths({})).toEqual([])
  })

  it('handles deeply nested null parent', () => {
    const data = { campaign: null, other: { x: 1 } }
    const paths = extractScalarPaths(data)

    expect(paths).toHaveLength(2)
    expect(paths).toContainEqual({ path: 'campaign', value: null, type: 'null' })
    expect(paths).toContainEqual({ path: 'other.x', value: 1, type: 'number' })
  })
})

describe('getByPath', () => {
  const data = {
    campaign: {
      stats: { spend: 100, clicks: 50 },
      name: 'Q1',
    },
    simple: 'hello',
  }

  it('retrieves value at dot path', () => {
    expect(getByPath(data, 'campaign.stats.spend')).toBe(100)
    expect(getByPath(data, 'campaign.name')).toBe('Q1')
    expect(getByPath(data, 'simple')).toBe('hello')
  })

  it('returns undefined for missing path', () => {
    expect(getByPath(data, 'campaign.stats.impressions')).toBeUndefined()
    expect(getByPath(data, 'nonexistent')).toBeUndefined()
  })

  it('returns undefined when intermediate is null', () => {
    const d = { campaign: null }
    expect(getByPath(d, 'campaign.stats.spend')).toBeUndefined()
  })

  it('handles root path', () => {
    expect(getByPath(data, '(root)')).toBe(data)
  })
})
