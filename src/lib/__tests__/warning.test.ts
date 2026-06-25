import { describe, it, expect } from 'vitest'
import { evaluateWarning, validateWarning } from '../warning'

describe('evaluateWarning — null/missing semantics', () => {
  it('returns true when comparison with present values is met', () => {
    expect(evaluateWarning('roas < 1.2', { roas: 1.0 })).toBe(true)
  })

  it('returns false when comparison with present values is not met', () => {
    expect(evaluateWarning('roas < 1.2', { roas: 1.5 })).toBe(false)
  })

  it('returns true for > comparison', () => {
    expect(evaluateWarning('spend > 100', { spend: 200 })).toBe(true)
  })

  it('returns false when variable is null', () => {
    expect(evaluateWarning('roas < 1.2', { roas: null })).toBe(false)
  })

  it('returns false when variable is missing from scope', () => {
    expect(evaluateWarning('roas < 1.2', {})).toBe(false)
  })

  it('returns false for logical expression with one null variable', () => {
    expect(evaluateWarning('spend > 100 and roas < 1.2', { spend: 200, roas: null })).toBe(false)
  })

  it('returns false for logical expression with missing variable', () => {
    expect(evaluateWarning('spend > 100 and roas < 1.2', { spend: 200 })).toBe(false)
  })

  it('handles dotted keys (ads.spend)', () => {
    expect(evaluateWarning('ads.spend > 100', { 'ads.spend': 150 })).toBe(true)
  })

  it('returns false when dotted key is null', () => {
    expect(evaluateWarning('ads.spend > 100', { 'ads.spend': null })).toBe(false)
  })

  it('returns false when dotted key is missing', () => {
    expect(evaluateWarning('ads.spend > 100', {})).toBe(false)
  })

  it('supports equality operator', () => {
    expect(evaluateWarning('status == 1', { status: 1 })).toBe(true)
    expect(evaluateWarning('status == 1', { status: 2 })).toBe(false)
  })

  it('supports logical OR', () => {
    expect(evaluateWarning('a > 10 or b < 5', { a: 1, b: 3 })).toBe(true)
  })

  it('returns false on catch (invalid expression)', () => {
    expect(evaluateWarning('a @ b', { a: 1, b: 2 })).toBe(false)
  })

  it('empty object scope returns false', () => {
    expect(evaluateWarning('a > 0', {})).toBe(false)
  })

  it('unreferenced null keys in scope do not affect result', () => {
    // 'other' is in scope but not referenced; 'a' is referenced and present
    expect(evaluateWarning('a > 10', { a: 20, other: null })).toBe(true)
  })

  it('supports and/or logical operators', () => {
    expect(evaluateWarning('a > 0 and b > 0', { a: 1, b: 2 })).toBe(true)
    expect(evaluateWarning('a > 0 and b > 10', { a: 1, b: 2 })).toBe(false)
    expect(evaluateWarning('a > 10 or b > 0', { a: 1, b: 2 })).toBe(true)
  })
})

describe('validateWarning', () => {
  it('accepts valid expressions', () => {
    expect(validateWarning('a > b')).toBeNull()
    expect(validateWarning('a + b > c')).toBeNull()
    expect(validateWarning('a == b and c > d')).toBeNull()
    expect(validateWarning('roas < 1.2 or spend > 100')).toBeNull()
  })

  it('rejects empty expressions', () => {
    expect(validateWarning('')).not.toBeNull()
  })

  it('rejects expressions without comparison operators', () => {
    expect(validateWarning('a + b')).not.toBeNull()
  })

  it('rejects function calls', () => {
    expect(validateWarning('sin(a)')).not.toBeNull()
  })

  it('rejects invalid characters', () => {
    expect(validateWarning('a @ b')).not.toBeNull()
  })
})
