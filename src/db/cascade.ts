import type { DashboardDB } from './index'

/**
 * One edge in the cascade graph:
 * When a record in the parent table is deleted, all records in `table`
 * where `by` matches the parent's id are recursively deleted.
 */
export interface CascadeEdge {
  table: keyof DashboardDB
  by: string
}

/**
 * Cascade graph — defines how deletes propagate through related tables.
 *
 * Adding a new related table means adding one entry here.
 * The cascade function handles the rest automatically.
 */
const CASCADE: Record<string, CascadeEdge[]> = {
  sessions: [
    { table: 'sources' as const, by: 'sessionId' },
    { table: 'pollCycles' as const, by: 'sessionId' },
    { table: 'derivedMetrics' as const, by: 'sessionId' },
    { table: 'charts' as const, by: 'sessionId' },
    { table: 'warningRules' as const, by: 'sessionId' },
    { table: 'sessionChatMessages' as const, by: 'sessionId' },
  ],
  sources: [
    { table: 'fieldMappings' as const, by: 'sourceId' },
  ],
  pollCycles: [
    { table: 'sourceResults' as const, by: 'cycleId' },
    { table: 'derivedValues' as const, by: 'cycleId' },
    { table: 'warningEvents' as const, by: 'cycleId' },
  ],
  sourceResults: [
    { table: 'mappedValues' as const, by: 'sourceResultId' },
  ],
}

// Helper: narrow the table access so TypeScript doesn't widen keyof DashboardDB
type TableName = keyof DashboardDB

/**
 * Recursively delete records from `parentTable` matching `parentIds`,
 * cascading to all child tables defined in the CASCADE graph.
 *
 * Uses depth-first traversal:
 *   1. Find child records for each child table
 *   2. Recurse into each child
 *   3. Delete parent records
 */
export async function cascadeDelete(
  db: DashboardDB,
  parentTable: TableName,
  parentIds: string[],
): Promise<void> {
  if (parentIds.length === 0) return

  const children = CASCADE[parentTable] as CascadeEdge[] | undefined
  if (children) {
    for (const child of children) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const childRecords = await (db[child.table] as any)
        .where(child.by)
        .anyOf(parentIds)
        .toArray()
      const childIds = (childRecords as { id: string }[]).map((r) => r.id)
      await cascadeDelete(db, child.table as TableName, childIds)
    }
  }

  // Delete parent records
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db[parentTable] as any).bulkDelete(parentIds)
}
