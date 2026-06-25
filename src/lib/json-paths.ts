import type { Scalar } from '@/db'

export type ScalarPath = {
  path: string
  value: Scalar
  type: 'string' | 'number' | 'boolean' | 'null'
}

/**
 * Recursively extract all scalar paths from a JSON value.
 * Nested objects are traversed; arrays are skipped (MVP: scalar only).
 * Paths use dot notation: `campaign.stats.spend`.
 */
export function extractScalarPaths(
  data: unknown,
  prefix = '',
): ScalarPath[] {
  if (data === null) {
    return [{ path: prefix || '(root)', value: null, type: 'null' }]
  }

  if (typeof data === 'string') {
    return [{ path: prefix || '(root)', value: data, type: 'string' }]
  }

  if (typeof data === 'number') {
    return [{ path: prefix || '(root)', value: data, type: 'number' }]
  }

  if (typeof data === 'boolean') {
    return [{ path: prefix || '(root)', value: data, type: 'boolean' }]
  }

  if (Array.isArray(data)) {
    // MVP: skip arrays
    return []
  }

  if (typeof data === 'object' && data !== null) {
    const results: ScalarPath[] = []
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const fullPath = prefix ? `${prefix}.${key}` : key
      results.push(...extractScalarPaths(value, fullPath))
    }
    return results
  }

  return []
}

/**
 * Get a value from a nested object using dot-path notation.
 * Returns `undefined` if any part of the path is missing.
 */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path || path === '(root)') return obj

  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}
