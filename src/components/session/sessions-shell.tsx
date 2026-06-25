import type { CSSProperties, ChangeEvent, PropsWithChildren } from 'react'
import { memo, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateSessionStatus, type Session, type WarningSeverity, type WarningState } from '@/db'
import { importSession } from '@/lib/import-export'
import { formatMsAsSeconds } from '@/lib/session-timing'
import { cn } from '@/lib/utils'
import { buttonVariants, Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import Activity from 'lucide-react/dist/esm/icons/activity'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Circle from 'lucide-react/dist/esm/icons/circle'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Pause from 'lucide-react/dist/esm/icons/pause'
import Play from 'lucide-react/dist/esm/icons/play'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Upload from 'lucide-react/dist/esm/icons/upload'

const SIDEBAR_WIDTH_DEFAULT = 18
const SIDEBAR_WIDTH_MIN = 16
const SIDEBAR_WIDTH_MAX = 22
const SIDEBAR_WIDTH_STORAGE_KEY = 'sessions-sidebar-width-rem'

type SessionSidebarItem = Session & {
  activeWarningCount: number
  activeWarningSeverities: WarningSeverity[]
}

export function SessionsShell({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const { id } = useParams({ strict: false }) as { id?: string }
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return SIDEBAR_WIDTH_DEFAULT
    const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY))
    if (!Number.isFinite(saved)) return SIDEBAR_WIDTH_DEFAULT
    return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, saved))
  })
  const [dragging, setDragging] = useState(false)

  const sessions = useLiveQuery(async (): Promise<SessionSidebarItem[]> => {
    const [sessions, rules, events] = await Promise.all([
      db.sessions.orderBy('updatedAt').reverse().toArray(),
      db.warningRules.toArray(),
      db.warningEvents.orderBy('timestamp').reverse().toArray(),
    ])

    const latestRuleState = new Map<string, WarningState>()
    for (const event of events) {
      if (!latestRuleState.has(event.ruleId)) {
        latestRuleState.set(event.ruleId, event.state)
      }
    }

    const warningsBySession = new Map<
      string,
      { count: number; severities: Set<WarningSeverity> }
    >()

    for (const rule of rules) {
      if (!rule.enabled) continue
      const state = latestRuleState.get(rule.id)
      if (state !== 'warning' && state !== 'critical') continue

      const current = warningsBySession.get(rule.sessionId) ?? {
        count: 0,
        severities: new Set<WarningSeverity>(),
      }

      current.count += 1
      current.severities.add(rule.severity)
      warningsBySession.set(rule.sessionId, current)
    }

    return sessions.map((session) => {
      const warning = warningsBySession.get(session.id)
      return {
        ...session,
        activeWarningCount: warning?.count ?? 0,
        activeWarningSeverities: warning
          ? (['critical', 'warning', 'info'] as WarningSeverity[]).filter((severity) =>
              warning.severities.has(severity),
            )
          : [],
      }
    })
  }, [], [])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    if (!dragging) return

    function handleMouseMove(event: MouseEvent) {
      const nextWidth = Math.min(
        SIDEBAR_WIDTH_MAX,
        Math.max(SIDEBAR_WIDTH_MIN, event.clientX / 16),
      )
      setSidebarWidth(nextWidth)
    }

    function handleMouseUp() {
      setDragging(false)
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging])

  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportError(null)
    try {
      const newId = await importSession(file)
      await navigate({ to: '/sessions/$id', params: { id: newId } })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <SidebarProvider
      className="min-h-[calc(100svh-57px)]"
      style={
        {
          '--sidebar-width': `${sidebarWidth}rem`,
          '--sidebar-width-mobile': '20rem',
        } as CSSProperties
      }
    >
      <Sidebar variant="sidebar" collapsible="offcanvas">
        <SidebarHeader className="h-14 justify-center border-b px-4 py-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Sessions</p>
              <p className="text-xs text-muted-foreground">
                {sessions.length} total
              </p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>All sessions</SidebarGroupLabel>
            <SidebarGroupContent>
              {sessions.length === 0 ? (
                <div className="px-2 py-6 text-sm text-muted-foreground">
                  No sessions yet.
                </div>
              ) : (
                <SidebarMenu className="gap-1">
                  {sessions.map((session) => (
                    <SessionMenuItem key={session.id} session={session} selected={session.id === id} />
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-2 p-3">
          {importError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {importError}
            </div>
          ) : null}

          <Link
            to="/sessions/new"
            className={cn(buttonVariants({ size: 'sm' }), 'w-full justify-center')}
          >
            <Plus data-icon="inline-start" />
            Create Session
          </Link>

          <Button
            size="sm"
            variant="outline"
            className="w-full justify-center"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Upload data-icon="inline-start" />}
            Import Session
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
        </SidebarFooter>

        <div
          className="absolute top-0 right-0 hidden h-full w-3 translate-x-1/2 cursor-col-resize md:block"
          onMouseDown={() => setDragging(true)}
        >
          <div className="mx-auto h-full w-px bg-border/70 transition-colors hover:bg-primary" />
        </div>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <p className="text-sm text-muted-foreground">Monitor and compare sessions</p>
        </div>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

const SessionMenuItem = memo(function SessionMenuItem({
  session,
  selected,
}: {
  session: SessionSidebarItem
  selected: boolean
}) {
  const [pending, setPending] = useState(false)

  const statusLabel =
    session.status === 'active'
      ? `Running · ${formatMsAsSeconds(session.pollIntervalMs)}s`
      : session.status === 'paused'
        ? `Paused · ${formatMsAsSeconds(session.pollIntervalMs)}s`
        : 'Stopped'

  const warningLabel =
    session.activeWarningCount > 0
      ? `${session.activeWarningCount} active warning${session.activeWarningCount === 1 ? '' : 's'}`
      : statusLabel

  async function handleToggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setPending(true)
    try {
      await updateSessionStatus(
        session.id,
        session.status === 'active' ? 'paused' : 'active',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <SidebarMenuItem className="mb-1 last:mb-0">
      <SidebarMenuButton
        render={<Link to="/sessions/$id" params={{ id: session.id }} />}
        isActive={selected}
        size="lg"
        className="h-auto min-h-[72px] items-start px-3 py-3 pr-11"
        tooltip={session.name}
      >
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate font-medium">{session.name}</span>
          <span className="truncate text-xs text-muted-foreground">{warningLabel}</span>
          {session.activeWarningCount > 0 ? (
            <span className="truncate text-[11px] text-muted-foreground">{statusLabel}</span>
          ) : null}
        </div>
      </SidebarMenuButton>

      {session.status !== 'stopped' ? (
        <SidebarMenuAction
          className="opacity-100"
          onClick={handleToggle}
          disabled={pending}
          aria-label={session.status === 'active' ? `Pause ${session.name}` : `Play ${session.name}`}
        >
          {pending ? <Loader2 className="animate-spin" /> : session.status === 'active' ? <Pause /> : <Play />}
        </SidebarMenuAction>
      ) : null}

      {session.activeWarningSeverities.length > 0 ? (
        <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1">
          {session.activeWarningSeverities.map((severity) => (
            severity === 'info' ? (
              <Circle key={severity} className="size-3.5 text-info" />
            ) : (
              <AlertTriangle
                key={severity}
                className={cn(
                  'size-3.5',
                  severity === 'critical' ? 'text-destructive' : 'text-warning',
                )}
              />
            )
          ))}
        </div>
      ) : null}
    </SidebarMenuItem>
  )
})
