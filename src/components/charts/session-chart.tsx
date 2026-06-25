import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Brush,
} from 'recharts'
import { memo, useMemo, useState } from 'react'
import type { ChartDataPoint } from '@/lib/pivot'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

interface SessionChartProps {
  data: ChartDataPoint[]
  series: { key: string; label: string; color: string }[]
}

/**
 * CSS custom property names can't contain dots.
 * Sanitize keys like `ads.spend` → `ads_spend`.
 */
function cssKey(key: string): string {
  return key.replaceAll('.', '_')
}

export const SessionChart = memo(function SessionChart({ data, series }: SessionChartProps) {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set())

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const visibleSeries = series.filter((s) => !hiddenSeries.has(s.key))
  const legend = (
    <div className="flex flex-wrap gap-1">
      {series.map((s) => {
        const hidden = hiddenSeries.has(s.key)
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => toggleSeries(s.key)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-all ${
              hidden
                ? 'bg-muted/50 text-muted-foreground/50'
                : 'bg-muted text-foreground hover:bg-accent'
            }`}
          >
            <span
              className={`inline-block size-2.5 rounded-sm ${
                hidden ? 'opacity-30' : ''
              }`}
              style={{ backgroundColor: s.color }}
            />
            <span className={hidden ? 'line-through' : ''}>
              {s.label}
            </span>
          </button>
        )
      })}
    </div>
  )
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {}
    for (const s of series) {
      config[cssKey(s.key)] = { label: s.label, color: s.color }
    }
    return config
  }, [series])

  // Transform data so dataKeys match sanitized CSS config keys
  const chartData = useMemo(() =>
    data.map((point) => {
      const mapped: Record<string, unknown> = { timestamp: point.timestamp }
      for (const s of series) {
        mapped[cssKey(s.key)] = point[s.key]
      }
      return mapped
    }),
    [data, series],
  )

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        {legend}
        <div className="flex h-[320px] items-center justify-center text-muted-foreground">
          Waiting for data...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {legend}

      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 11 }}
            tickFormatter={(t) =>
              new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          />
          <YAxis tick={{ fontSize: 11 }} />
          <ChartTooltip
            content={<ChartTooltipContent indicator="dot" labelFormatter={(v) => new Date(v as string).toLocaleString()} />}
          />
          <Brush
            dataKey="timestamp"
            height={20}
            stroke="#8884d8"
            tickFormatter={(t) =>
              new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          />
          {visibleSeries.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={cssKey(s.key)}
              stroke={`var(--color-${cssKey(s.key)})`}
              name={s.label}
              dot={false}
              strokeWidth={2}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  )
})
