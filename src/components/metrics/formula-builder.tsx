import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { Input } from '@/components/ui/input'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import MousePointerClick from 'lucide-react/dist/esm/icons/mouse-pointer-click'

const DERIVED_OPS = ['+', '-', '*', '/', '(', ')'] as const
const WARNING_OPS = ['>', '>=', '<', '<=', '==', '!=', '&&', '||', '(', ')'] as const
const DIGITS = ['0','1','2','3','4','5','6','7','8','9','.'] as const

interface FormulaBuilderProps {
  sessionId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  mode?: 'derived' | 'warning'
}

export function FormulaBuilder({
  sessionId,
  value,
  onChange,
  placeholder,
  mode = 'derived',
}: FormulaBuilderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [inputMode, setInputMode] = useState<'builder' | 'free'>('builder')

  // Load all available fields for this session
  const fields = useLiveQuery(async () => {
    const sources = await db.sources.where('sessionId').equals(sessionId).toArray()
    if (sources.length === 0) return []

    const sourceIds = sources.map((s) => s.id)
    const sourceKeyMap = new Map(sources.map((s) => [s.id, s.key]))

    const mappings = await db.fieldMappings
      .where('sourceId')
      .anyOf(sourceIds)
      .toArray()

    return mappings.map((m) => ({
      key: `${sourceKeyMap.get(m.sourceId) ?? '?'}.${m.key}`,
      label: m.label,
    }))
  }, [sessionId])

  function insertAtCursor(text: string) {
    const input = inputRef.current
    if (!input) {
      onChange(value + text)
      return
    }

    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    const before = value.slice(0, start)
    const after = value.slice(end)
    const newValue = before + text + after
    onChange(newValue)

    // Restore cursor position after the inserted text
    requestAnimationFrame(() => {
      const pos = start + text.length
      input.setSelectionRange(pos, pos)
      input.focus()
    })
  }

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-md border bg-muted/30 p-0.5 text-xs w-fit">
        <button
          type="button"
          onClick={() => setInputMode('builder')}
          className={`rounded px-2.5 py-1 font-medium transition-colors ${
            inputMode === 'builder'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <MousePointerClick className="mr-1 inline-block size-3" />
          Builder
        </button>
        <button
          type="button"
          onClick={() => setInputMode('free')}
          className={`rounded px-2.5 py-1 font-medium transition-colors ${
            inputMode === 'free'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Pencil className="mr-1 inline-block size-3" />
          Free write
        </button>
      </div>

      {/* Formula input */}
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'crowdfunding.amount / ads.spend'}
        className="font-mono text-sm"
        readOnly={inputMode === 'builder'}
      />

      <p className="text-xs text-muted-foreground">
        {inputMode === 'builder'
          ? 'Click a field or operator below to insert it into the formula.'
          : 'Type your formula directly. You can still click fields and operators below as shortcuts.'}
      </p>

      {fields && fields.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Fields</p>
          <div className="flex flex-wrap gap-1">
            {fields.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => insertAtCursor(f.key)}
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs font-mono text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                title={f.label}
              >
                {f.key}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Numbers</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {DIGITS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => insertAtCursor(d)}
              className="inline-flex size-7 items-center justify-center rounded-md border bg-background text-xs font-mono transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange(value.slice(0, -1))}
            className="inline-flex size-7 items-center justify-center rounded-md border bg-background text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            ⌫
          </button>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Operators</p>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-xs text-destructive hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {(mode === 'warning' ? WARNING_OPS : DERIVED_OPS).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => insertAtCursor(` ${op} `)}
              className="inline-flex size-7 items-center justify-center rounded-md border bg-background text-xs font-mono transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {op === '&&' ? 'AND' : op === '||' ? 'OR' : op}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
