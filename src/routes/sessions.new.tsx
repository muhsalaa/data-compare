import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { createSession } from '@/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_POLL_INTERVAL_MS, DEFAULT_TIMEOUT_MS, MIN_POLL_INTERVAL_MS, MIN_TIMEOUT_MS, formatMsAsSeconds, maxTimeoutMsForInterval, secondsToMs, validateSessionTiming } from '@/lib/session-timing'
import { SessionsShell } from '@/components/session/sessions-shell'

export const Route = createFileRoute('/sessions/new')({
  component: NewSessionPage,
})

function NewSessionPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL_MS / 1000)
  const [timeout, setTimeout_] = useState(DEFAULT_TIMEOUT_MS / 1000)
  const [submitting, setSubmitting] = useState(false)
  const pollIntervalMs = secondsToMs(pollInterval)
  const timeoutMs = secondsToMs(timeout)
  const timingError = validateSessionTiming({ pollIntervalMs, timeoutMs })
  const safePollIntervalMs = Number.isFinite(pollIntervalMs) ? Math.max(pollIntervalMs, MIN_POLL_INTERVAL_MS) : MIN_POLL_INTERVAL_MS
  const maxTimeoutLabel = formatMsAsSeconds(maxTimeoutMsForInterval(safePollIntervalMs))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    if (timingError) return

    setSubmitting(true)
    try {
      const session = await createSession({
        name: name.trim(),
        description: description.trim() || undefined,
        pollIntervalMs,
        timeoutMs,
      })
      toast.success('Session created')
      await navigate({ to: '/sessions/$id', params: { id: session.id } })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SessionsShell>
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>New Session</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Session name</Label>
                <Input
                  id="name"
                  placeholder="My Campaign"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Track ad spend vs donations. Healthy = ROAS above 1.5."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Used by AI copilot for business context.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="interval">Poll interval (seconds)</Label>
                  <Input
                    id="interval"
                    type="number"
                    min={MIN_POLL_INTERVAL_MS / 1000}
                    step="0.1"
                    value={pollInterval}
                    onChange={(e) => setPollInterval(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Min {formatMsAsSeconds(MIN_POLL_INTERVAL_MS)}s</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min={MIN_TIMEOUT_MS / 1000}
                    max={maxTimeoutMsForInterval(safePollIntervalMs) / 1000}
                    step="0.1"
                    value={timeout}
                    onChange={(e) => setTimeout_(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Default {formatMsAsSeconds(DEFAULT_TIMEOUT_MS)}s · Max {maxTimeoutLabel}s</p>
                </div>
              </div>

              {timingError && (
                <p className="text-sm text-destructive">{timingError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={submitting || !name.trim() || !!timingError}>
                  {submitting ? 'Creating...' : 'Create Session'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate({ to: '/sessions' })}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </SessionsShell>
  )
}
