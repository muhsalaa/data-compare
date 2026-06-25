import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import { Link, useNavigate, Outlet, useRouterState, useParams } from '@tanstack/react-router'
import { db, updateSessionStatus, deleteSession } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { pivotChartData } from '@/lib/pivot'
import type { ChartDataPoint } from '@/lib/pivot'
import { StatCards } from '@/components/dashboard/stat-cards'
import { ChartBuilder } from '@/components/dashboard/chart-builder'
import { HistoryTable } from '@/components/dashboard/history-table'
import { WarningsPanel } from '@/components/dashboard/warnings-panel'
import { CHART_COLORS } from '@/lib/constants'
import { computeStatCards } from '@/lib/stats'
import { formatMsAsSeconds } from '@/lib/session-timing'
import Pause from 'lucide-react/dist/esm/icons/pause'
import Play from 'lucide-react/dist/esm/icons/play'
import Square from 'lucide-react/dist/esm/icons/square'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Settings from 'lucide-react/dist/esm/icons/settings'
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'

const SessionChart = lazy(() =>
  import('@/components/charts/session-chart').then((module) => ({
    default: module.SessionChart,
  })),
)

function preloadSettingsPage() {
  void import('@/components/session/settings-page')
}

function ChartSkeleton({ label = 'Loading chart…' }: { label?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {[88, 104, 96].map((width, index) => (
          <div
            key={index}
            className="h-7 animate-pulse rounded-md bg-muted"
            style={{ width }}
          />
        ))}
      </div>
      <div className="flex h-[320px] w-full flex-col justify-between rounded-md border border-dashed border-border/60 p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="grid flex-1 grid-cols-12 items-end gap-2 py-4">
          {[36, 52, 44, 68, 58, 76, 62, 84, 56, 70, 48, 64].map((height, index) => (
            <div
              key={index}
              className="animate-pulse rounded-sm bg-muted"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function SessionChartPanel({
  data,
  series,
  loadingLabel,
}: {
  data?: ChartDataPoint[]
  series: { key: string; label: string; color: string }[]
  loadingLabel?: string
}) {
  return (
    <Suspense fallback={<ChartSkeleton label={loadingLabel} />}>
      <SessionChart data={data ?? []} series={series} />
    </Suspense>
  )
}

function SessionPageSkeleton() {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <div className="size-9 animate-pulse rounded-md bg-muted" />
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="ml-auto h-6 w-20 animate-pulse rounded-full bg-muted" />
      </div>

      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="flex gap-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="mb-2 h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="mb-2 h-6 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3 w-12 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="mb-4 h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-16 animate-pulse rounded-md bg-muted" />
      </div>

      <div className="mb-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="mb-4 h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-7 w-64 animate-pulse rounded bg-muted" />
          <div className="h-[320px] animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <div className="mb-4 h-5 w-28 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SessionPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [stopOpen, setStopOpen] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id])
  const sources = useLiveQuery(() => db.sources.where('sessionId').equals(id).toArray(), [id], [])
  const mappings = useLiveQuery(async () => {
    const srcs = await db.sources.where('sessionId').equals(id).toArray()
    if (srcs.length === 0) return []
    return db.fieldMappings.where('sourceId').anyOf(srcs.map((s) => s.id)).toArray()
  }, [id], [])
  const derivedMetrics = useLiveQuery(() => db.derivedMetrics.where('sessionId').equals(id).toArray(), [id], [])
  const charts = useLiveQuery(() => db.charts.where('sessionId').equals(id).toArray(), [id], [])
  const warningRuleCount = useLiveQuery(() => db.warningRules.where('sessionId').equals(id).count(), [id])
  const cycleCount = useLiveQuery(() => db.pollCycles.where('sessionId').equals(id).count(), [id], 0)

  useEffect(() => {
    const online = () => setIsOffline(false)
    const offline = () => setIsOffline(true)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])

  const [refreshKey, setRefreshKey] = useState(0)
  const handleRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const availableSeries = useMemo(
    () => [
      ...(mappings?.map((m) => {
        const source = sources?.find((s) => s.id === m.sourceId)
        return { key: `${source?.key ?? '?'}.${m.key}`, label: m.label }
      }) ?? []),
      ...(derivedMetrics?.map((dm) => ({ key: dm.key, label: dm.label })) ?? []),
    ],
    [mappings, sources, derivedMetrics],
  )
  const userCharts = useMemo(() => charts, [charts])
  const availableSeriesLabelByKey = useMemo(
    () => new Map(availableSeries.map((series) => [series.key, series.label])),
    [availableSeries],
  )
  const overviewChartSeries = useMemo(
    () =>
      availableSeries.map((s, i) => ({
        key: s.key,
        label: s.label,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [availableSeries],
  )

  // Alert sound on new warning/critical events
  const lastAlertEventId = useRef<string | null>(null)

  function playAlertSound() {
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {
      /* audio not available */
    }
  }

  useEffect(() => {
    if (!cycleCount || cycleCount <= 0) return

    async function checkAlerts() {
      const latest = await db.warningEvents
        .orderBy('timestamp')
        .reverse()
        .first()
      if (!latest) return
      if (latest.id === lastAlertEventId.current) return
      lastAlertEventId.current = latest.id

      if (latest.state === 'warning' || latest.state === 'critical') {
        // Only play sound if rule severity is warning or critical (not info)
        const rule = await db.warningRules.get(latest.ruleId)
        if (rule && rule.severity !== 'info') {
          playAlertSound()
        }
      }
    }

    checkAlerts()
  }, [cycleCount])

  const allChartData = useLiveQuery<Record<string, ChartDataPoint[]>, Record<string, ChartDataPoint[]>>(
    async () => {
      if (!session) return {}

      const chartSeries = [
        ...availableSeries.map((s) => s.key),
        ...userCharts.flatMap((chart) => chart.series),
      ]
      const uniqueSeries = [...new Set(chartSeries)]
      if (uniqueSeries.length === 0) return {}

      const sharedChartData = await pivotChartData(id, uniqueSeries)
      const newData: Record<string, ChartDataPoint[]> = {}

      if (availableSeries.length > 0) {
        newData.__auto__ = sharedChartData
      }
      for (const chart of userCharts) {
        if (chart.series.length > 0) {
          newData[chart.id] = sharedChartData
        }
      }

      return newData
    },
    [id, refreshKey, session, availableSeries, userCharts],
    {},
  )

  const statCards = useLiveQuery(
    async () => {
      if (!session) return []
      return computeStatCards(id, sources, mappings, derivedMetrics)
    },
    [id, refreshKey, session, sources, mappings, derivedMetrics],
  )

  const routerState = useRouterState()
  const isChildRoute = routerState.matches.some((m) => m.routeId === '/sessions/$id/settings')

  if (session === undefined) {
    return <SessionPageSkeleton />
  }

  if (session === null) {
    return <div className="py-12 text-center text-muted-foreground">Session not found.</div>
  }

  async function handleStatusChange(ns: 'active' | 'paused' | 'stopped') {
    await updateSessionStatus(id, ns)
    const labels = { active: 'Resumed', paused: 'Paused', stopped: 'Stopped' }
    toast.success(`Session ${labels[ns]}`)
  }

  async function handleDelete() {
    await deleteSession(id)
    toast.success('Session deleted')
    setDeleteOpen(false)
    await navigate({ to: '/sessions' })
  }

  return (
    <div>
      {isOffline && session.status === 'active' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
          <WifiOff className="size-4 text-yellow-600" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Offline — showing data from last poll
          </p>
        </div>
      )}

      {isChildRoute ? (
        <Outlet />
      ) : (
        <>
          <div className="mb-6 flex items-center gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{session.name}</h2>
            </div>
            <StatusBadge status={session.status as 'active' | 'paused' | 'stopped'} />
          </div>

          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Poll every {formatMsAsSeconds(session.pollIntervalMs)}s</span>
              <span className="text-xs">·</span>
              <span>{cycleCount ?? 0} cycles</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="mr-1 size-4" /> Refresh
              </Button>
              {session.status === 'active' && (
                <Button variant="outline" size="sm" onClick={() => handleStatusChange('paused')}>
                  <Pause className="mr-2 size-4" /> Pause
                </Button>
              )}
              {session.status === 'paused' && (
                <Button variant="outline" size="sm" onClick={() => handleStatusChange('active')}>
                  <Play className="mr-2 size-4" /> Resume
                </Button>
              )}
              {(session.status === 'active' || session.status === 'paused') && (
                <Dialog open={stopOpen} onOpenChange={setStopOpen}>
                  <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex items-center')}>
                    <Square className="mr-2 size-4" /> Stop
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Stop this session?</DialogTitle>
                      <DialogDescription>
                        Polling will stop immediately. All collected data, charts, and
                        history remain readable. You can resume or start a new session
                        later.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setStopOpen(false)}>Cancel</Button>
                      <Button
                        variant="destructive"
                        onClick={async () => {
                          await handleStatusChange('stopped')
                          setStopOpen(false)
                        }}
                      >
                        Stop Session
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              <Link
                to="/sessions/$id/settings"
                params={{ id }}
                onMouseEnter={preloadSettingsPage}
                onFocus={preloadSettingsPage}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex items-center')}
              >
                <Settings className="mr-2 size-4" /> Settings
              </Link>
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger className={cn(buttonVariants({ variant: 'destructive', size: 'sm' }), 'inline-flex items-center')}>
                  <Trash2 className="mr-2 size-4" /> Delete
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete session?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete "{session.name}" and all its data. Cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete}>Delete Session</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {statCards && statCards.length > 0 ? (
            <div className="mb-6">
              <StatCards cards={statCards} />
            </div>
          ) : null}

          {warningRuleCount && warningRuleCount > 0 ? (
            <div className="mb-6">
              <WarningsPanel sessionId={id} />
            </div>
          ) : null}

          <div className="mb-6 space-y-6">
            {availableSeries.length > 0 ? (
              cycleCount === 0 ? (
                <Card>
                  <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="mb-3 size-8 animate-spin text-muted-foreground" />
                      <p className="text-sm font-medium">Waiting for first poll...</p>
                      <p className="text-xs text-muted-foreground">Data will appear here after the first fetch cycle.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
                  <CardContent>
                    {allChartData?.__auto__ ? (
                      <SessionChartPanel
                        data={allChartData.__auto__}
                        series={overviewChartSeries}
                        loadingLabel="Loading overview chart…"
                      />
                    ) : (
                      <ChartSkeleton label="Loading overview chart…" />
                    )}
                  </CardContent>
                </Card>
              )
            ) : null}
            {userCharts.map((chart) => (
              <Card key={chart.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{chart.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await db.charts.delete(chart.id)
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {allChartData?.[chart.id] ? (
                    <SessionChartPanel
                      data={allChartData[chart.id]}
                      loadingLabel={`Loading ${chart.name}…`}
                      series={chart.series.map((key, i) => {
                        return {
                          key,
                          label: availableSeriesLabelByKey.get(key) ?? key,
                          color: CHART_COLORS[i % CHART_COLORS.length],
                        }
                      })}
                    />
                  ) : (
                    <ChartSkeleton label={`Loading ${chart.name}…`} />
                  )}
                </CardContent>
              </Card>
            ))}
            {availableSeries.length > 0 ? (
              <ChartBuilder sessionId={id} availableSeries={availableSeries} maxCharts={3} />
            ) : (
              <Link
                to="/sessions/$id/settings"
                params={{ id }}
                className={cn(
                  'flex items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border px-4 py-3 transition-colors hover:border-primary/40',
                )}
              >
                <Plus className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Add Data Source</p>
                  <p className="text-xs text-muted-foreground">
                    Set up a data source to start monitoring
                  </p>
                </div>
              </Link>
            )}
          </div>

          <div className="mb-6">
            <HistoryTable sessionId={id} />
          </div>
        </>
      )}
    </div>
  )
}
