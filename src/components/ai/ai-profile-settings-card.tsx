import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { db, saveAIProfile, validateAIProfile, type AIProfile, type AITransport } from '@/db'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_GO_MODELS = [
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'kimi-k2.7',
  'kimi-k2.6',
  'glm-5.2',
  'glm-5.1',
  'mimo-v2.5',
  'mimo-v2.5-pro',
  'minimax-m3',
  'minimax-m2.7',
  'qwen3.7-max',
  'qwen3.7-plus',
  'qwen3.6-plus',
]

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
          <div className="h-24 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    )
  }

  return <AIProfileSettingsCardBody key={profile?.id ?? 'new'} profile={profile} />
}

function AIProfileSettingsCardBody({ profile }: { profile: AIProfile | null }) {
  const [name, setName] = useState(profile?.name ?? 'Default profile')
  const [baseUrl, setBaseUrl] = useState(profile?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState(profile?.apiKey ?? '')
  const [model, setModel] = useState(profile?.model ?? '')
  const [transport, setTransport] = useState<AITransport>(profile?.transport ?? 'direct')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const validationError = validateAIProfile({ name, baseUrl, apiKey, model })
  const suggestedModels = baseUrl.trim() === OPENCODE_GO_BASE_URL ? OPENCODE_GO_MODELS : []
  const modelItems = suggestedModels.map((m) => ({ label: m, value: m }))

  async function handleSave() {
    if (validationError) return

    setSaving(true)
    try {
      await saveAIProfile({
        id: profile?.id,
        name,
        baseUrl,
        apiKey,
        model,
        transport,
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
          Stored locally in IndexedDB. Direct mode calls the provider from the browser. Relay mode calls your own proxy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-profile-name">Profile Name</Label>
          <Input
            id="ai-profile-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setDirty(true)
            }}
            placeholder="Default profile"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-base-url">Base URL</Label>
          <Input
            id="ai-base-url"
            value={baseUrl}
            onChange={(event) => {
              setBaseUrl(event.target.value)
              setDirty(true)
            }}
            placeholder="https://openrouter.ai/api/v1/chat/completions"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-model">Model</Label>
            {suggestedModels.length > 0 ? (
              <Select
                items={modelItems}
                value={model}
                onValueChange={(value) => {
                  if (value) setModel(value)
                  setDirty(true)
                }}
              >
                <SelectTrigger className="w-full" aria-label="Select model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {modelItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="ai-model"
                value={model}
                onChange={(event) => {
                  setModel(event.target.value)
                  setDirty(true)
                }}
                placeholder="deepseek-v4-flash"
              />
            )}
            <div className="min-w-0 space-y-1">
              {suggestedModels.length > 0 ? (
                <p className="text-xs text-muted-foreground">OpenCode Go preset models.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Enter a model ID manually.</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Transport</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={transport === 'direct' ? 'default' : 'outline'}
                onClick={() => {
                  setTransport('direct')
                  setDirty(true)
                }}
              >
                Direct
              </Button>
              <Button
                type="button"
                size="sm"
                variant={transport === 'relay' ? 'default' : 'outline'}
                onClick={() => {
                  setTransport('relay')
                  setDirty(true)
                }}
              >
                Relay
              </Button>
            </div>
          </div>
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
            placeholder="sk-..."
          />
          <p className="text-xs text-muted-foreground">
            Sensitive: this key stays in the browser profile on this device.
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
