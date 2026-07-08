import { useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { db } from '@/db'
import { sendSessionChatMessage } from '@/lib/ai'
import { clearSessionChatMessages, createSessionChatMessage, updateSessionChatMessage } from '@/lib/ai/storage'
import { detectAIProviderPreset } from '@/lib/ai/provider-presets'
import { SESSION_COPILOT_PRESETS } from '@/lib/ai/presets'
import { COPILOT_TOOLS } from '@/lib/ai/tools'
import { ActionProposal } from '@/components/ai/action-proposal'
import { ENABLE_COPILOT_ACTIONS } from '@/lib/constants'
import type { CopilotAction } from '@/lib/ai/types'
import { cn } from '@/lib/utils'
import { ChatMarkdown } from '@/components/ai/chat-markdown'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import Bot from 'lucide-react/dist/esm/icons/bot'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'

export function SessionCopilotDrawer({
  sessionId,
  sessionDescription,
  cycleCount,
  warningRuleCount,
  sourceCount,
  mappingCount,
  metricCount,
}: {
  sessionId: string
  sessionDescription?: string
  cycleCount: number
  warningRuleCount: number
  sourceCount: number
  mappingCount: number
  metricCount: number
}) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'context'>('context')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messageViewportRef = useRef<HTMLDivElement | null>(null)

  const profile = useLiveQuery(
    async () => (await db.aiProfiles.orderBy('updatedAt').reverse().filter((item) => item.enabled).first()) ?? null,
    [],
    undefined,
  )
  const messages = useLiveQuery(
    () => db.sessionChatMessages.where('sessionId').equals(sessionId).sortBy('createdAt'),
    [sessionId],
    [],
  )

  const preset = profile ? detectAIProviderPreset(profile.baseUrl) : null
  const profileMissing = profile === null
  const profileLoading = profile === undefined
  const profileReady = !profileMissing && !profileLoading
  const lastMessage = messages.at(-1)

  useEffect(() => {
    if (!open) return
    const viewport = messageViewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [lastMessage?.content, lastMessage?.id, messages.length, open])

  async function handleClearChat() {
    await clearSessionChatMessages(sessionId)
    setError(null)
    toast.success('Chat cleared')
  }

  async function handleSend(text: string) {
    const nextText = text.trim()
    if (!nextText || sending) return

    setSending(true)
    setError(null)
    setInput('')

    try {
      await sendSessionChatMessage({
        sessionId,
        userText: nextText,
        tools: ENABLE_COPILOT_ACTIONS ? COPILOT_TOOLS : undefined,
      })
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Failed to send message'
      setError(message)
      setInput(nextText)
      toast.error(message)
    } finally {
      setSending(false)
    }
  }

  async function handleApplied(actionDescription: string) {
    await createSessionChatMessage({
      sessionId,
      role: 'assistant',
      content: `Applied: ${actionDescription}`,
      meta: { systemNote: true },
    })
  }

  return (
    <>
      {profileMissing ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button size="sm" variant="outline" disabled>
                <Bot data-icon="inline-start" />
                AI
              </Button>
            </TooltipTrigger>
            <TooltipContent>You must set an AI profile in settings first.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={profileLoading}>
          <Bot data-icon="inline-start" />
          AI
        </Button>
      )}

      <Drawer open={open} onOpenChange={setOpen} direction="right" repositionInputs={false}>
        <DrawerContent className="w-full sm:min-w-[430px] sm:max-w-[90vw] lg:min-w-[510px] lg:max-w-[90vw]">
          <DrawerHeader className="gap-3 border-b pr-14 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <DrawerTitle className="tracking-tight">Session Copilot</DrawerTitle>
                    <Badge variant="secondary">{messages.length}</Badge>
                  </div>
                  {activeTab === 'chat' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="shrink-0"
                      disabled={messages.length === 0 || sending}
                      onClick={() => void handleClearChat()}
                    >
                      <Trash2 data-icon="inline-start" />
                      Clear
                    </Button>
                  ) : null}
                </div>
                <DrawerDescription className="mt-1 max-w-[42ch] text-[0.9375rem] leading-6">
                  Ask about this session only. The copilot uses saved config, recent history, and bounded evidence.
                </DrawerDescription>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {profile ? (
                <>
                  <Badge variant="outline">{preset?.label ?? profile.name}</Badge>
                  <Badge variant="outline">{profile.model}</Badge>
                  <Badge variant="outline">{profile.transport}</Badge>
                </>
              ) : profile === null ? (
                <span>No AI profile configured yet.</span>
              ) : (
                <span>Loading AI profile…</span>
              )}
            </div>
          </DrawerHeader>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'chat' | 'context')} className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="context">Context</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="mt-4 flex min-h-0 flex-1 flex-col">
              <div
                ref={messageViewportRef}
                className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center">
                    <p className="text-sm font-medium text-foreground">No chat yet</p>
                    <p className="mt-1 max-w-[28ch] text-sm leading-6 text-muted-foreground">
                      Ask a question, or use a quick prompt in the context tab.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 pb-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn('flex flex-col gap-1.5', message.role === 'user' ? 'items-end' : 'items-start')}
                      >
                        <div className="px-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                          {message.role === 'user' ? 'You' : 'Copilot'}
                        </div>
                        <div
                          className={cn(
                            'max-w-[92%] rounded-2xl px-4 py-3 text-[0.9rem] leading-6',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'border bg-background text-foreground',
                          )}
                        >
                          {message.content ? (
                            <div className="space-y-3 text-[0.9rem] leading-6">
                              <ChatMarkdown content={message.content} />
                            </div>
                          ) : sending && message.role === 'assistant' ? (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" />
                              <span>Thinking…</span>
                            </div>
                          ) : null}
                          {message.role === 'assistant' && message.meta?.toolCalls && message.meta.toolCalls.length > 0 && (
                            <div className="mt-3 space-y-3">
                              {message.meta.toolCalls.map((toolCall, index) => {
                                let action: CopilotAction | null = null
                                try {
                                  const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
                                  action = { type: toolCall.function.name, payload: args } as CopilotAction
                                } catch {
                                  return null
                                }
                                const resolved = message.meta?.toolCallStatuses?.[toolCall.id]
                                const summary = (() => {
                                  switch (action.type) {
                                    case 'create_derived_metric':
                                      return `${action.payload.label} (${action.payload.key})`
                                    case 'create_warning_rule':
                                      return action.payload.name
                                    case 'create_chart':
                                      return action.payload.name
                                    default:
                                      return 'unknown action'
                                  }
                                })()
                                return (
                                  <ActionProposal
                                    key={index}
                                    sessionId={sessionId}
                                    action={action}
                                    initialStatus={resolved}
                                    onStatusChange={(status) => {
                                      void updateSessionChatMessage(message.id, {
                                        meta: {
                                          ...message.meta,
                                          toolCallStatuses: {
                                            ...message.meta?.toolCallStatuses,
                                            [toolCall.id]: status,
                                          },
                                        },
                                      })
                                    }}
                                    onApplied={() => void handleApplied(summary)}
                                  />
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t pt-4">
                {error ? (
                  <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                {profileMissing ? (
                  <div className="mb-3 rounded-xl border px-3 py-2 text-sm text-muted-foreground">
                    Add an AI profile first in{' '}
                    <Link
                      to="/sessions/$id/settings"
                      params={{ id: sessionId }}
                      className={cn(buttonVariants({ variant: 'link', size: 'sm' }), 'h-auto px-0 text-sm')}
                    >
                      settings
                    </Link>
                    .
                  </div>
                ) : null}

                <div className="flex flex-col gap-3">
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        void handleSend(input)
                      }
                    }}
                    placeholder="Ask what changed, what looks risky, or what to monitor next."
                    disabled={sending || !profileReady}
                    className="min-h-24 text-[0.9rem] leading-6"
                  />
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Enter sends, Shift+Enter adds a newline.
                    </p>
                    <Button
                      type="button"
                      onClick={() => void handleSend(input)}
                      disabled={!input.trim() || sending || !profileReady}
                    >
                      {sending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Bot data-icon="inline-start" />}
                      {sending ? 'Sending…' : 'Send'}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="context" className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
              <div className="flex flex-col gap-3 pb-2">
                <div className="rounded-xl border px-4 py-3">
                  <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Session description
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {sessionDescription?.trim() || 'No description yet. Add one in settings for better AI context.'}
                  </p>
                </div>

                <div className="rounded-xl border px-4 py-3">
                  <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    What AI can see
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{sourceCount} sources</Badge>
                    <Badge variant="outline">{mappingCount} mappings</Badge>
                    <Badge variant="outline">{metricCount} metrics</Badge>
                    <Badge variant="outline">{warningRuleCount} warning rules</Badge>
                    <Badge variant="outline">{cycleCount} cycles</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Context is bounded. Large raw payloads are trimmed before they reach the model.
                  </p>
                </div>

                <div className="rounded-xl border px-4 py-3">
                  <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Quick prompts
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SESSION_COPILOT_PRESETS.map((item) => (
                      <Button
                        key={item.id}
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={sending || !profileReady}
                        onClick={() => {
                          setActiveTab('chat')
                          void handleSend(item.prompt)
                        }}
                      >
                        <Sparkles data-icon="inline-start" />
                        {item.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DrawerContent>
      </Drawer>
    </>
  )
}
