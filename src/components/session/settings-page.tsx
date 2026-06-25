import { useState, lazy, Suspense, useEffect } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { toast } from 'sonner'
import { db, updateSessionDetails } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AIProfileSettingsCard } from '@/components/ai/ai-profile-settings-card'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import Save from 'lucide-react/dist/esm/icons/save'
import Pause from 'lucide-react/dist/esm/icons/pause'
import Download from 'lucide-react/dist/esm/icons/download'
import { exportSession, downloadExport } from '@/lib/import-export'
import type { Session } from '@/db'
import { DEFAULT_TIMEOUT_MS, MIN_POLL_INTERVAL_MS, MIN_TIMEOUT_MS, formatMsAsSeconds, maxTimeoutMsForInterval, secondsToMs, validateSessionTiming } from '@/lib/session-timing'

const SourceForm = lazy(() =>
  import('@/components/sources/source-form').then((module) => ({
    default: module.SourceForm,
  })),
)

const DerivedMetricsForm = lazy(() =>
  import('@/components/metrics/derived-metrics-form').then((module) => ({
    default: module.DerivedMetricsForm,
  })),
)

const WarningRulesForm = lazy(() =>
  import('@/components/dashboard/warning-rules-form').then((module) => ({
    default: module.WarningRulesForm,
  })),
)

function DelayedSettingsCardSkeleton({ title }: { title: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setShow(true), 150)
    return () => window.clearTimeout(timer)
  }, [])

  if (!show) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-9 animate-pulse rounded-md bg-muted" />
        <div className="h-9 animate-pulse rounded-md bg-muted" />
        <div className="h-20 animate-pulse rounded-md bg-muted" />
      </CardContent>
    </Card>
  )
}

function preloadSettingsForms() {
  void import('@/components/sources/source-form')
  void import('@/components/metrics/derived-metrics-form')
  void import('@/components/dashboard/warning-rules-form')
}

/**
 * Child component that holds session form draft state.
 * Rendered with key={session.id} so React remounts (and re-initializes state)
 * when the session changes — avoids synchronizing state in an effect.
 */
function SessionDetailsCard({ session, sessionId }: { session: Session; sessionId: string }) {
  const [editName, setEditName] = useState(session.name)
  const [editDescription, setEditDescription] = useState(session.description ?? '')
  const [editInterval, setEditInterval] = useState(session.pollIntervalMs / 1000)
  const [editTimeout, setEditTimeout] = useState(session.timeoutMs / 1000)
  const [sessionDirty, setSessionDirty] = useState(false)
  const pollIntervalMs = secondsToMs(editInterval)
  const timeoutMs = secondsToMs(editTimeout)
  const timingError = validateSessionTiming({ pollIntervalMs, timeoutMs })
  const safePollIntervalMs = Number.isFinite(pollIntervalMs) ? Math.max(pollIntervalMs, MIN_POLL_INTERVAL_MS) : MIN_POLL_INTERVAL_MS
  const maxTimeoutLabel = formatMsAsSeconds(maxTimeoutMsForInterval(safePollIntervalMs))

  function handleNameChange(v: string) { setEditName(v); setSessionDirty(true) }
  function handleDescriptionChange(v: string) { setEditDescription(v); setSessionDirty(true) }
  function handleIntervalChange(v: number) { setEditInterval(v); setSessionDirty(true) }
  function handleTimeoutChange(v: number) { setEditTimeout(v); setSessionDirty(true) }

  async function saveSessionDetails() {
    if (!editName.trim() || timingError) return

    await updateSessionDetails(sessionId, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      pollIntervalMs,
      timeoutMs,
    })
    toast.success('Session settings saved')
    setSessionDirty(false)
  }

  return (
    <Card>
      <CardHeader><CardTitle>Session Details</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sess-name">Name</Label>
          <Input id="sess-name" value={editName} onChange={(e) => handleNameChange(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sess-description">Description</Label>
          <Textarea
            id="sess-description"
            value={editDescription}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Track ad spend vs donations. Healthy = ROAS above 1.5."
          />
          <p className="text-xs text-muted-foreground">Used by AI copilot for business context.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sess-interval">Poll Interval (seconds)</Label>
            <Input id="sess-interval" type="number" min={MIN_POLL_INTERVAL_MS / 1000} step="0.1" value={editInterval} onChange={(e) => handleIntervalChange(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sess-timeout">Timeout (seconds)</Label>
            <Input id="sess-timeout" type="number" min={MIN_TIMEOUT_MS / 1000} max={maxTimeoutMsForInterval(safePollIntervalMs) / 1000} step="0.1" value={editTimeout} onChange={(e) => handleTimeoutChange(Number(e.target.value))} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Status: <span className="capitalize">{session.status}</span> · Created: {new Date(session.createdAt).toLocaleString()}
        </div>
        <p className="text-xs text-muted-foreground">
          Timeout max for this interval: {maxTimeoutLabel}s · Default timeout {formatMsAsSeconds(DEFAULT_TIMEOUT_MS)}s
        </p>
        {timingError && (
          <p className="text-sm text-destructive">{timingError}</p>
        )}
        {sessionDirty && (
          <Button size="sm" onClick={saveSessionDetails} disabled={!editName.trim() || !!timingError}><Save className="mr-1 size-4" />Save Changes</Button>
        )}
      </CardContent>
    </Card>
  )
}

export function SessionSettingsPage() {
  const { id } = useParams({ strict: false }) as { id: string }

  useEffect(() => {
    preloadSettingsForms()
  }, [])

  const [addingSource, setAddingSource] = useState(false)
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)

  const session = useLiveQuery(async () => (await db.sessions.get(id)) ?? null, [id])
  const sources = useLiveQuery(() => db.sources.where('sessionId').equals(id).toArray(), [id], [])

  // Load mappings for the source being edited
  const editingMappings = useLiveQuery(
    async () => {
      if (!editingSourceId) return undefined
      return db.fieldMappings.where('sourceId').equals(editingSourceId).toArray()
    },
    [editingSourceId],
  )

  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const data = await exportSession(id)
      downloadExport(data, session!.name)
    } finally {
      setExporting(false)
    }
  }

  if (session === undefined) {
    return <DelayedSettingsCardSkeleton title="Loading settings" />
  }

  if (session === null) {
    return <div className="py-12 text-center text-muted-foreground">Session not found.</div>
  }

  if (addingSource || editingSourceId) {
    const editingSource = editingSourceId ? sources?.find((s) => s.id === editingSourceId) ?? null : null
    return (
      <div>
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setAddingSource(false); setEditingSourceId(null) }}>
            <ArrowLeft className="size-4" />
          </Button>
          <h2 className="text-2xl font-semibold">{editingSourceId ? 'Edit Source' : 'Add Data Source'}</h2>
        </div>
        {editingSourceId && editingMappings === undefined ? (
          <DelayedSettingsCardSkeleton title="Edit Source" />
        ) : (
          <Suspense fallback={<DelayedSettingsCardSkeleton title={editingSourceId ? 'Edit Source' : 'Add Data Source'} />}>
            <SourceForm
              sessionId={id}
              source={editingSource}
              mappings={editingMappings}
              onSaved={() => { setAddingSource(false); setEditingSourceId(null) }}
              onCancel={() => { setAddingSource(false); setEditingSourceId(null) }}
            />
          </Suspense>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link to="/sessions/$id" params={{ id }} className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
          <ArrowLeft className="size-4" />
        </Link>
        <h2 className="text-2xl font-semibold flex-1">Settings</h2>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="mr-1 size-4" />
          {exporting ? 'Exporting...' : 'Export'}
        </Button>
      </div>

      <div className="grid gap-4">
        {session && (
          <SessionDetailsCard key={session.id} session={session} sessionId={id} />
        )}

        <AIProfileSettingsCard />

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Data Sources</CardTitle>
              {session.status === 'active' && (
                <p className="mt-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                  Sources are locked while session is active. Pause to add or edit.
                </p>
              )}
            </div>
            {session.status === 'active' ? (
              <Button size="sm" variant="outline" className="border-yellow-400 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-600 dark:text-yellow-400 dark:hover:bg-yellow-950" onClick={() => db.sessions.update(id, { status: 'paused', updatedAt: new Date().toISOString() })}>
                <Pause className="mr-1 size-3" /> Pause Session
              </Button>
            ) : (
              <Button size="sm" onClick={() => setAddingSource(true)}>
                <Plus className="mr-1 size-4" /> Add Source
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!sources || sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data sources configured. Add one to start monitoring.</p>
            ) : (
              <div className="space-y-2">
                {sources.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">Key: {s.key} · {s.url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={s.enabled ? 'enabled' : 'disabled'} />
                      <Button variant="ghost" size="icon" onClick={() => setEditingSourceId(s.id)} disabled={session.status === 'active'}>
                        <Settings2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {sources.length > 0 ? (
          <>
            <Suspense fallback={<DelayedSettingsCardSkeleton title="Derived Metrics" />}>
              <DerivedMetricsForm sessionId={id} />
            </Suspense>
            <Suspense fallback={<DelayedSettingsCardSkeleton title="Warning Rules" />}>
              <WarningRulesForm sessionId={id} />
            </Suspense>
          </>
        ) : (
          <>
            <Card className="opacity-50">
              <CardHeader><CardTitle>Derived Metrics</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Add a data source first to create derived metrics.</p></CardContent>
            </Card>
            <Card className="opacity-50">
              <CardHeader><CardTitle>Warning Rules</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Add a data source first to create warning rules.</p></CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
