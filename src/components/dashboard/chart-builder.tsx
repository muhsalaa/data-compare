import { useState } from 'react'
import { db, newId, nowISO, type Chart } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { cn } from '@/lib/utils'

interface SeriesOption {
  key: string
  label: string
}

interface ChartBuilderProps {
  sessionId: string
  availableSeries: SeriesOption[]
  maxCharts?: number
}

export function ChartBuilder({ sessionId, availableSeries, maxCharts }: ChartBuilderProps) {
  const [adding, setAdding] = useState(false)
  const [chartName, setChartName] = useState('')
  const [selectedSeries, setSelectedSeries] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const charts = useLiveQuery(
    () => db.charts.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  ) ?? []

  function toggleSeries(key: string) {
    setSelectedSeries((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function resetForm() {
    setChartName('')
    setSelectedSeries(new Set())
    setAdding(false)
  }

  async function handleSave() {
    if (!chartName.trim() || selectedSeries.size === 0) return

    setSaving(true)
    try {
      const chart: Chart = {
        id: newId(),
        sessionId,
        name: chartName.trim(),
        series: [...selectedSeries],
        createdAt: nowISO(),
      }
      await db.charts.add(chart)
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  const atLimit = maxCharts !== undefined && charts.length >= maxCharts

  return (
    <div>
      {/* Add button */}
      {!adding && (
        <button
          type="button"
          disabled={atLimit}
          className={cn(
            'w-full rounded-lg border-2 border-dashed border-border px-4 py-3 transition-colors',
            atLimit
              ? 'opacity-50 cursor-not-allowed'
              : 'cursor-pointer hover:border-primary/40',
          )}
          onClick={() => { if (!atLimit) setAdding(true) }}
        >
          <div className="flex items-center justify-center gap-3">
            <Plus className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-left">Add Chart</p>
              <p className="text-xs text-muted-foreground text-left">
                {atLimit
                  ? `Maximum ${maxCharts} charts reached`
                  : `Custom chart with specific series`}
              </p>
            </div>
          </div>
        </button>
      )}

      {/* Add form */}
      {adding && (
        <Card>
          <CardHeader>
            <CardTitle>New Chart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Chart Name</Label>
              <Input
                placeholder="Campaign Performance"
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Select Series</Label>
              <div className="max-h-40 space-y-1 overflow-auto rounded-md border p-2">
                {availableSeries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No fields or metrics available. Add sources and derived metrics first.
                  </p>
                ) : (
                  availableSeries.map((s) => (
                    <label
                      key={s.key}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-1 text-sm cursor-pointer hover:bg-accent',
                        selectedSeries.has(s.key) && 'bg-accent',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSeries.has(s.key)}
                        onChange={() => toggleSeries(s.key)}
                        className="size-4"
                      />
                      <span className="font-mono text-xs text-muted-foreground">{s.key}</span>
                      <span>{s.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                Save Chart
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
