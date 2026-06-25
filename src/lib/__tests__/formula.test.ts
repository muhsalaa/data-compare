import { describe, it, expect } from 'vitest'
import { evaluateFormula, validateFormula } from '../formula'

describe('evaluateFormula', () => {
  it('evaluates basic arithmetic', () => {
    expect(evaluateFormula('a + b', { a: 10, b: 5 })).toBe(15)
    expect(evaluateFormula('a - b', { a: 10, b: 5 })).toBe(5)
    expect(evaluateFormula('a * b', { a: 10, b: 5 })).toBe(50)
    expect(evaluateFormula('a / b', { a: 10, b: 5 })).toBe(2)
  })

  it('handles parentheses', () => {
    expect(evaluateFormula('(a + b) * c', { a: 1, b: 2, c: 3 })).toBe(9)
  })

  it('references mapped fields with dot keys', () => {
    expect(evaluateFormula('ads.spend / ads.clicks', { 'ads.spend': 100, 'ads.clicks': 50 })).toBe(2)
  })

  it('returns null on division by zero', () => {
    expect(evaluateFormula('a / b', { a: 10, b: 0 })).toBeNull()
  })

  it('returns null when variable is null', () => {
    expect(evaluateFormula('a + b', { a: 10, b: null })).toBeNull()
  })

  it('returns null when variable is undefined', () => {
    expect(evaluateFormula('a + b', { a: 10 })).toBeNull()
  })

  it('returns null when variable is missing entirely', () => {
    expect(evaluateFormula('a + b', {})).toBeNull()
  })
})

describe('validateFormula', () => {
  it('accepts valid formulas', () => {
    expect(validateFormula('a + b')).toBeNull()
    expect(validateFormula('a / b')).toBeNull()
    expect(validateFormula('(a + b) * c')).toBeNull()
    expect(validateFormula('campaign.amount / ads.spend')).toBeNull()
    expect(validateFormula('42')).toBeNull()
  })

  it('rejects comparison operators', () => {
    expect(validateFormula('a > b')).not.toBeNull()
    expect(validateFormula('a < b')).not.toBeNull()
    expect(validateFormula('a == b')).not.toBeNull()
  })

  it('rejects empty formula', () => {
    expect(validateFormula('')).not.toBeNull()
  })

  it('rejects function calls', () => {
    expect(validateFormula('sin(a)')).not.toBeNull()
  })

  it('rejects malformed syntax', () => {
    expect(validateFormula('a +')).not.toBeNull()
    expect(validateFormula('a / / b')).not.toBeNull()
  })
})
