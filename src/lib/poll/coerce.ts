import type { FieldType, Scalar } from '@/db'

/**
 * Coerce a raw JSON value to the expected scalar type.
 * Returns null when coercion fails or the value is null/undefined.
 */
export function coerceScalar(raw: unknown, expectedType: FieldType): Scalar {
  if (raw === null || raw === undefined) return null
  if (expectedType === 'number' && typeof raw === 'number') return raw
  if (expectedType === 'number' && typeof raw === 'string') {
    const n = Number(raw)
    return Number.isNaN(n) ? null : n
  }
  if (expectedType === 'string') return String(raw)
  if (expectedType === 'boolean') return Boolean(raw)
  return null
}
