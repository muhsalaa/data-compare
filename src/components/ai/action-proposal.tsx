import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { executeAction } from '@/lib/ai'
import type { CopilotAction } from '@/lib/ai/types'
import { cn } from '@/lib/utils'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'

interface ActionProposalProps {
  sessionId: string
  action: CopilotAction
  onApplied?: () => void
  onDismissed?: () => void
}

function actionSummary(action: CopilotAction): { title: string; details: string } {
  switch (action.type) {
    case 'create_derived_metric':
      return {
        title: 'Create derived metric',
        details: `${action.payload.label} (${action.payload.key}) = ${action.payload.formula}`,
      }
    case 'create_warning_rule':
      return {
        title: 'Create warning rule',
        details: `${action.payload.name}: ${action.payload.expression}`,
      }
    case 'create_chart':
      return {
        title: 'Create chart',
        details: `${action.payload.name}: ${action.payload.series.join(', ')}`,
      }
    default:
      return { title: 'Unknown action', details: '' }
  }
}

function severityBadge(severity: string): string {
  switch (severity) {
    case 'info':
      return 'bg-blue-100 text-blue-800'
    case 'warning':
      return 'bg-yellow-100 text-yellow-800'
    case 'critical':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function ActionProposal({ sessionId, action, onApplied, onDismissed }: ActionProposalProps) {
  const [status, setStatus] = useState<'idle' | 'applying' | 'applied' | 'dismissed' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const summary = actionSummary(action)

  async function handleApply() {
    setStatus('applying')
    setError(null)
    try {
      const result = await executeAction(sessionId, action)
      if (result.ok) {
        setStatus('applied')
        onApplied?.()
      } else {
        setStatus('error')
        setError(result.error ?? 'Action failed')
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  function handleDismiss() {
    setStatus('dismissed')
    onDismissed?.()
  }

  if (status === 'dismissed') return null

  return (
    <Card className={cn('border-l-4 border-l-primary')}> 
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">{summary.title}</CardTitle>
          {'severity' in action.payload && typeof action.payload.severity === 'string' && (
            <Badge
              variant="outline"
              className={cn('text-[10px] font-medium', severityBadge(action.payload.severity))}
            >
              {action.payload.severity}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{summary.details}</p>

        {status === 'applied' ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="size-4" />
            Applied
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void handleApply()}
              disabled={status === 'applying'}
            >
              {status === 'applying' && <Loader2 className="mr-1 size-3 animate-spin" />}
              Apply
            </Button>
            <Button size="sm" variant="outline" onClick={handleDismiss} disabled={status === 'applying'}>
              <X className="mr-1 size-3" />
              Dismiss
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
