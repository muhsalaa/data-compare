import { memo, useState, Fragment } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { getRecentCycles } from '@/lib/history'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2'
import XCircle from 'lucide-react/dist/esm/icons/x-circle'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'

interface HistoryTableProps {
  sessionId: string
}

const HISTORY_LIMIT = 50
const RAW_JSON_MAX = 2000

function RawJsonPreview({ data }: { data: unknown }) {
  const raw = JSON.stringify(data, null, 2)
  const truncated = raw.length > RAW_JSON_MAX
  const display = truncated ? raw.slice(0, RAW_JSON_MAX) + '\n… (truncated)' : raw

  return (
    <pre className="max-h-48 overflow-auto rounded border bg-background p-2 text-[10px] leading-relaxed">
      {display}
    </pre>
  )
}

export const HistoryTable = memo(function HistoryTable({ sessionId }: HistoryTableProps) {
  const [expanded, setExpanded] = useState(new Set<string>())

  const toggleRow = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const data = useLiveQuery(
    async () => {
      const cycles = await getRecentCycles(sessionId, HISTORY_LIMIT)
      if (cycles.length === 0) return null

      const cycleIds = cycles.map((c) => c.id)

      const sourceResults = await db.sourceResults.where('cycleId').anyOf(cycleIds).toArray()

      const sourceIds = [...new Set(sourceResults.map((r) => r.sourceId))]
      const sources =
        sourceIds.length > 0
          ? await db.sources.where('id').anyOf(sourceIds).toArray()
          : []
      const sourcesMap = new Map(sources.map((s) => [s.id, s]))

      // Labels per source (for the Data tag column)
      const allMappings =
        sourceIds.length > 0
          ? await db.fieldMappings.where('sourceId').anyOf(sourceIds).toArray()
          : []
      const labelsBySource = new Map<string, string[]>()
      const mappingsById = new Map(allMappings.map((m) => [m.id, m]))
      for (const m of allMappings) {
        const arr = labelsBySource.get(m.sourceId) ?? []
        arr.push(m.label)
        labelsBySource.set(m.sourceId, arr)
      }

      // Mapped values per source result (for expanded view)
      const resultIds = sourceResults.map((r) => r.id)
      const allMappedValues =
        resultIds.length > 0
          ? await db.mappedValues.where('sourceResultId').anyOf(resultIds).toArray()
          : []
      const valuesByResult = new Map<string, { label: string; value: unknown }[]>()
      for (const mv of allMappedValues) {
        const mapping = mappingsById.get(mv.mappingId)
        const arr = valuesByResult.get(mv.sourceResultId) ?? []
        arr.push({ label: mapping?.label ?? mv.mappingId, value: mv.value })
        valuesByResult.set(mv.sourceResultId, arr)
      }

      return {
        cycles,
        sourceResults,
        sourcesMap,
        labelsBySource,
        valuesByResult,
      }
    },
    [sessionId],
  )

  if (!data) return null

  const { cycles, sourceResults, sourcesMap, labelsBySource, valuesByResult } = data

  if (cycles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fetch History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No poll cycles yet. Start the session to see history.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fetch History</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-4">
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="sticky top-0 bg-card pb-2 pl-2 pr-3 font-medium" />
                <th className="sticky top-0 bg-card pb-2 pr-3 font-medium">Time</th>
                <th className="sticky top-0 bg-card pb-2 pr-3 font-medium">Source</th>
                <th className="sticky top-0 bg-card pb-2 pr-3 font-medium">Data</th>
                <th className="sticky top-0 bg-card pb-2 pr-3 font-medium">Duration</th>
                <th className="sticky top-0 bg-card pb-2 pr-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) =>
                sourceResults
                  .filter((r) => r.cycleId === cycle.id)
                  .map((result) => {
                    const rowKey = `${cycle.id}-${result.id}`
                    const source = sourcesMap.get(result.sourceId)
                    const labels = source ? labelsBySource.get(source.id) : undefined
                    const values = valuesByResult.get(result.id)
                    const isOpen = expanded.has(rowKey)

                    return (
                      <Fragment key={rowKey}>
                        <tr
                          className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                          onClick={() => toggleRow(rowKey)}
                        >
                          <td className="py-1.5 pl-2 pr-3">
                            {isOpen ? (
                              <ChevronDown className="size-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-3 text-muted-foreground" />
                            )}
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-xs">
                            {new Date(cycle.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-1.5 pr-3 text-xs font-medium">
                            {source?.key ?? '?'}
                          </td>
                          <td className="py-1.5 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {labels?.length
                                ? labels.map((l) => (
                                    <span
                                      key={l}
                                      className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                    >
                                      {l}
                                    </span>
                                  ))
                                : null}
                            </div>
                          </td>
                          <td className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">
                            {result.durationMs}ms
                          </td>
                          <td className="py-1.5 pr-2">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1 text-xs text-success">
                                <CheckCircle2 className="size-3" />
                                OK
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-destructive"
                                title={result.error ?? ''}
                              >
                                <XCircle className="size-3" />
                                Failed
                              </span>
                            )}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b bg-muted/20 last:border-0">
                            <td colSpan={6}>
                              <div className="grid grid-cols-2 gap-4 p-3">
                                {/* Mapped values */}
                                <div>
                                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                                    Mapped Values
                                  </p>
                                  {values && values.length > 0 ? (
                                    <table className="w-full text-xs">
                                      <tbody>
                                        {values.map((v, i) => (
                                          <tr key={i} className="border-b border-border/30 last:border-0">
                                            <td className="py-1 pr-3 text-muted-foreground">{v.label}</td>
                                            <td className="py-1 font-mono tabular-nums">{String(v.value ?? '—')}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No mapped values</p>
                                  )}
                                </div>

                                {/* Raw response */}
                                <div>
                                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                                    Raw Response
                                  </p>
                                  {result.rawJson != null ? (
                                    <RawJsonPreview data={result.rawJson} />
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      {result.error ?? 'No data'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  }),
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
})
