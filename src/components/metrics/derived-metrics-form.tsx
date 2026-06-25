import { useState } from 'react'
import { toast } from 'sonner'
import { db, newId, type DerivedMetric } from '@/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { validateFormula } from '@/lib/formula'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormulaBuilder } from '@/components/metrics/formula-builder'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'

interface DerivedMetricsFormProps {
  sessionId: string
}

export function DerivedMetricsForm({ sessionId }: DerivedMetricsFormProps) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [formula, setFormula] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Load existing metrics
  const metrics = useLiveQuery(
    () => db.derivedMetrics.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  ) ?? []

  function startEdit(m: DerivedMetric) {
    setEditingId(m.id)
    setLabel(m.label)
    setKey(m.key)
    setFormula(m.formula)
    setError(null)
    setAdding(true)
  }

  function resetForm() {
    setLabel('')
    setKey('')
    setFormula('')
    setError(null)
    setAdding(false)
    setEditingId(null)
  }

  function handleKeyChange(v: string) {
    // Bare key: no dots, no special chars
    setKey(v.replace(/[^a-zA-Z0-9_]/g, ''))
  }

  async function handleSave() {
    if (!label.trim()) {
      setError('Label is required')
      return
    }
    if (!key.trim()) {
      setError('Key is required')
      return
    }
    if (!formula.trim()) {
      setError('Formula is required')
      return
    }

    // Validate key: no dots (derived metrics are bare keys)
    if (key.includes('.')) {
      setError('Derived metric keys cannot contain dots. Use a simple name like "roas".')
      return
    }

    // Validate formula
    const validationError = validateFormula(formula)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await db.derivedMetrics.update(editingId, {
          label: label.trim(),
          key: key.trim(),
          formula: formula.trim(),
        })
      } else {
        const metric: DerivedMetric = {
          id: newId(),
          sessionId,
          label: label.trim(),
          key: key.trim(),
          formula: formula.trim(),
        }
        await db.derivedMetrics.add(metric)
      }
      toast.success(editingId ? 'Metric updated' : 'Metric added')
      resetForm()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await db.derivedMetrics.delete(id)
    toast.success('Metric deleted')
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Derived Metrics</CardTitle>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 size-4" />
            Add Metric
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {!adding ? (
          <>
            {metrics.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{m.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {m.key} = {m.formula}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(m)}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(m.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            {metrics.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No derived metrics. Create one to compute values from your mapped
                fields. Example: ROAS = amount / spend.
              </p>
            )}
          </>
        ) : null}

        {/* Add form */}
        {adding && (
          <div className="space-y-3 rounded-md border p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Label</Label>
                <Input
                  placeholder="ROAS"
                  value={label}
                  onChange={(e) => { setLabel(e.target.value); setError(null) }}
                />
              </div>
              <div className="space-y-1">
                <Label>Key</Label>
                <Input
                  placeholder="roas"
                  value={key}
                  onChange={(e) => { handleKeyChange(e.target.value); setError(null) }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Formula</Label>
              <FormulaBuilder
                sessionId={sessionId}
                value={formula}
                onChange={setFormula}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-1 size-3 animate-spin" />
                ) : null}
                {editingId ? 'Update' : 'Save'}
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
