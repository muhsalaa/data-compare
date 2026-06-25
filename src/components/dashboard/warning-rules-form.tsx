import { useState } from 'react'
import { toast } from 'sonner'
import { db, newId, type WarningRule, type WarningSeverity } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { validateWarning } from '@/lib/warning'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormulaBuilder } from '@/components/metrics/formula-builder'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { cn } from '@/lib/utils'

interface WarningRulesFormProps {
  sessionId: string
}

const SEVERITIES: { value: WarningSeverity; label: string; color: string }[] = [
  { value: 'info', label: 'Info', color: 'bg-blue-100 text-blue-800' },
  { value: 'warning', label: 'Warning', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
]

export function WarningRulesForm({ sessionId }: WarningRulesFormProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [expression, setExpression] = useState('')
  const [severity, setSeverity] = useState<WarningSeverity>('warning')
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Real-time validation
  const expressionError = expression.trim() ? validateWarning(expression) : null

  const rules = useLiveQuery(
    () => db.warningRules.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  ) ?? []

  function startEdit(rule: WarningRule) {
    setEditingId(rule.id)
    setName(rule.name)
    setExpression(rule.expression)
    setSeverity(rule.severity)
    setEnabled(rule.enabled)
    setError(null)
    setAdding(true)
  }

  function resetForm() {
    setName('')
    setExpression('')
    setSeverity('warning')
    setEnabled(true)
    setError(null)
    setAdding(false)
    setEditingId(null)
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Rule name is required')
      return
    }
    if (!expression.trim()) {
      setError('Expression is required')
      return
    }

    if (expressionError) {
      setError(expressionError)
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await db.warningRules.update(editingId, {
          name: name.trim(),
          expression: expression.trim(),
          severity,
          enabled,
        })
        toast.success('Warning rule updated')
      } else {
        const rule: WarningRule = {
          id: newId(),
          sessionId,
          name: name.trim(),
          expression: expression.trim(),
          severity,
          enabled,
        }
        await db.warningRules.add(rule)
        toast.success('Warning rule created')
      }
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await db.warningRules.delete(id)
    await db.warningEvents.where('ruleId').equals(id).delete()
    toast.success('Warning rule deleted')
  }

  async function toggleEnabled(rule: WarningRule) {
    await db.warningRules.update(rule.id, { enabled: !rule.enabled })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Warning Rules</CardTitle>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 size-4" />
            Add Rule
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!adding ? (
          <>
            {rules.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{r.name}</p>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                        SEVERITIES.find((s) => s.value === r.severity)?.color,
                      )}
                    >
                      {r.severity}
                    </span>
                    {!r.enabled && (
                      <span className="text-[10px] text-muted-foreground">disabled</span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">
                    {r.expression}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => toggleEnabled(r)}
                  >
                    {r.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => startEdit(r)}>
                    <Pencil className="size-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {rules.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No warning rules. Create one to get alerts when metrics look bad.
                Example: roas &lt; 1.2 &amp;&amp; ads.spend &gt; 100
              </p>
            )}
          </>
        ) : null}

        {adding && (
          <div className="space-y-3 rounded-md border p-4">
            <div className="space-y-1">
              <Label>Rule Name</Label>
              <Input
                placeholder="Low ROAS Alert"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(null) }}
              />
            </div>
            <div className="space-y-1">
              <Label>Expression</Label>
              <FormulaBuilder
                sessionId={sessionId}
                value={expression}
                onChange={(v) => { setExpression(v); setError(null) }}
                placeholder="roas < 1.2 && ads.spend > 100"
                mode="warning"
              />
            </div>
            <div className="space-y-1">
              <Label>Severity</Label>
              <div className="flex gap-2">
                {SEVERITIES.map((s) => (
                  <Button
                    key={s.value}
                    type="button"
                    size="sm"
                    variant={severity === s.value ? 'default' : 'outline'}
                    onClick={() => setSeverity(s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="size-4"
              />
              Enabled
            </label>
            {(expressionError || error) && (
              <p className="text-sm text-destructive">{expressionError ?? error}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
                {editingId ? 'Update Rule' : 'Save Rule'}
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
