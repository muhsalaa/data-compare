import { useState, memo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type WarningSeverity } from '@/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import Circle from 'lucide-react/dist/esm/icons/circle'
import { cn } from '@/lib/utils'

interface WarningsPanelProps {
  sessionId: string
}

const SEVERITY_COLORS: Record<WarningSeverity, string> = {
  info: 'bg-[color-mix(in_oklch,var(--color-info),transparent_85%)] text-info',
  warning: 'bg-[color-mix(in_oklch,var(--color-warning),transparent_85%)] text-warning',
  critical: 'bg-[color-mix(in_oklch,var(--color-destructive),transparent_85%)] text-destructive',
}

const SEVERITY_ICONS: Record<WarningSeverity, typeof AlertTriangle> = {
  info: Circle,
  warning: AlertTriangle,
  critical: AlertTriangle,
}

export const WarningsPanel = memo(function WarningsPanel({ sessionId }: WarningsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  const rules = useLiveQuery(
    () => db.warningRules.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  )

  const recentEvents = useLiveQuery(
    () =>
      db.warningEvents
        .orderBy('timestamp')
        .reverse()
        .limit(50)
        .toArray(),
    [sessionId],
  )

  // Filter events for rules in this session
  const ruleIds = new Set(rules?.map((r) => r.id) ?? [])
  const filteredEvents = recentEvents?.filter((e) => ruleIds.has(e.ruleId)) ?? []

  // Get latest state per rule from events (or from in-memory if no events yet)
  const ruleStateMap = new Map<string, { state: string; transition: string; timestamp: string; eventId: string }>()
  for (const event of filteredEvents) {
    if (!ruleStateMap.has(event.ruleId)) {
      ruleStateMap.set(event.ruleId, {
        state: event.state,
        transition: event.transition,
        timestamp: event.timestamp,
        eventId: event.id,
      })
    }
  }

  // Active warnings: rules currently in warning/critical state
  const activeWarnings = rules?.filter((r) => {
    const state = ruleStateMap.get(r.id)
    return state && state.state !== 'healthy' && r.enabled
  }) ?? []

  const healthyCount = rules?.filter((r) => {
    const state = ruleStateMap.get(r.id)
    return state?.state === 'healthy' || !state
  }).length ?? 0

  if (!rules || rules.length === 0) return null

  return (
    <Card>
      <CardHeader
        className="flex cursor-pointer flex-row items-center justify-between"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
      >
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4" />
          Warnings
          {activeWarnings.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {activeWarnings.length}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>
            {activeWarnings.length} active · {healthyCount} healthy
          </span>
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3">
          {/* Legend */}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium hover:text-foreground">
              How alerts work
            </summary>
            <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-3">
              <p><strong>Initial evaluation:</strong> On the first poll, the rule state is recorded silently. No event is created until the rule transitions to a different state.</p>
              <p><strong>Null values:</strong> If a metric referenced in the expression is missing or null, the rule evaluates as healthy rather than treating the missing value as zero.</p>
              <p><strong>State transitions:</strong> Events only fire when the rule changes state (e.g. <code>healthy→warning</code>, <code>warning→healthy</code>).</p>
              <p><strong>No spam:</strong> If the rule stays in the same state across polls, no duplicate events. You only see transitions in the history.</p>
            </div>
          </details>

          {/* Active warnings */}
          {activeWarnings.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Active Warnings
              </p>
              <div className="space-y-2">
                {activeWarnings.map((rule) => {
                  const state = ruleStateMap.get(rule.id)
                  const Icon = SEVERITY_ICONS[rule.severity]
                  return (
                    <div
                      key={rule.id}
                      className={cn(
                        'flex items-start gap-3 rounded-md border p-3',
                        rule.severity === 'critical' && 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
                      )}
                    >
                      <Icon
                        className={cn(
                          'mt-0.5 size-4',
                          rule.severity === 'critical'
                            ? 'text-red-600'
                            : rule.severity === 'warning'
                              ? 'text-yellow-600'
                              : 'text-blue-600',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{rule.name}</p>
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                              SEVERITY_COLORS[rule.severity],
                            )}
                          >
                            {rule.severity}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">
                          {rule.expression}
                        </p>
                        {state && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {state.transition.split('→')[0]} → {rule.severity} —{' '}
                            {new Date(state.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent history */}
          {filteredEvents.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Recent Events
              </p>
              <div className="max-h-48 space-y-1 overflow-auto">
                {filteredEvents.slice(0, 20).map((event) => {
                  const rule = rules?.find((r) => r.id === event.ruleId)
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                    >
                      <span
                        className={cn(
                          'inline-flex size-1.5 rounded-full',
                          event.state === 'healthy'
                            ? 'bg-green-500'
                            : event.state === 'warning'
                              ? 'bg-yellow-500'
                              : 'bg-red-500',
                        )}
                      />
                      <span className="font-medium truncate">
                        {rule?.name ?? 'Unknown rule'}
                      </span>
                      <span className="text-muted-foreground">
                        {event.transition.split('→')[0]} → {rule?.severity ?? event.transition.split('→')[1]}
                      </span>
                      <span className="ml-auto text-muted-foreground">
                        {new Date(event.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
})
