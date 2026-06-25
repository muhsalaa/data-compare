import { db, newId } from '@/db'
import { getByPath } from '@/lib/json-paths'
import { coerceScalar } from './coerce'
import type { FetchSourceResult } from './fetch-stage'

/**
 * Stage 2: Extract mapped values from successful fetch results.
 * Writes mapped_values to IndexedDB.
 */
export async function extractMappedValues(results: FetchSourceResult[]): Promise<void> {
  for (const result of results) {
    if (!result.success || !result.hasData) continue

    // Read raw JSON from the source result we just wrote
    const sourceResult = await db.sourceResults.get(result.sourceResultId)
    if (!sourceResult?.rawJson) continue

    const mappings = await db.fieldMappings.where('sourceId').equals(result.sourceId).toArray()
    if (mappings.length === 0) continue

    for (const mapping of mappings) {
      const rawValue = getByPath(sourceResult.rawJson, mapping.jsonPath)
      const value = coerceScalar(rawValue, mapping.type)

      await db.mappedValues.add({
        id: newId(),
        sourceResultId: result.sourceResultId,
        mappingId: mapping.id,
        value,
      })
    }
  }
}
