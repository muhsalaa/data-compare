import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { db, saveAIProfile, validateAIProfile, type AIProfile } from '@/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'
const DEFAULT_PROFILE_NAME = 'OpenRouter'
const DEFAULT_TRANSPORT = 'direct' as const

export function AIProfileSettingsCard() {
  const profile = useLiveQuery(async () => (await db.aiProfiles.orderBy('updatedAt').reverse().first()) ?? null, [], undefined)

  if (profile === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Copilot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-9 animate-pulse rounded-md bg-muted" />
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    )
  }

  return <AIProfileSettingsCardBody key={profile?.id ?? 'new'} profile={profile} />
}

function AIProfileSettingsCardBody({ profile }: { profile: AIProfile | null }) {
  const [apiKey, setApiKey] = useState(profile?.apiKey ?? '')
  const [model, setModel] = useState(profile?.model ?? '')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const validationError = validateAIProfile({
    name: DEFAULT_PROFILE_NAME,
    baseUrl: OPENROUTER_BASE_URL,
    apiKey,
    model,
  })

  async function handleSave() {
    if (validationError) return

    setSaving(true)
    try {
      await saveAIProfile({
        id: profile?.id,
        name: DEFAULT_PROFILE_NAME,
        baseUrl: OPENROUTER_BASE_URL,
        apiKey,
        model,
        transport: DEFAULT_TRANSPORT,
        enabled: true,
      })
      toast.success('AI profile saved')
      setDirty(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save AI profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Copilot</CardTitle>
        <CardDescription>
          Currently only OpenRouter is supported. Stored locally in IndexedDB on this device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border px-3 py-2 text-xs text-muted-foreground">
          Endpoint is fixed to <span className="font-medium text-foreground">OpenRouter</span> for now.
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-api-key">API Key</Label>
          <Input
            id="ai-api-key"
            type="password"
            value={apiKey}
            onChange={(event) => {
              setApiKey(event.target.value)
              setDirty(true)
            }}
            placeholder="sk-or-v1-..."
          />
          <p className="text-xs text-muted-foreground">
            Sensitive: this key stays in your browser profile on this device.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-model">Model</Label>
          <Input
            id="ai-model"
            value={model}
            onChange={(event) => {
              setModel(event.target.value)
              setDirty(true)
            }}
            placeholder="openai/gpt-4.1-mini"
          />
          <p className="text-xs text-muted-foreground">
            Use an exact OpenRouter model ID, including any <code>:free</code> suffix.
          </p>
        </div>

        {dirty && validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}

        {dirty ? (
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || !!validationError}>
            {saving ? 'Saving...' : 'Save AI Profile'}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
