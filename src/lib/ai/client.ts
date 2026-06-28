import { throwIfAborted } from '@/lib/abort'
import { db } from '@/db'
import { buildDefaultSessionContext } from '@/lib/ai/context'
import { getAIProfile } from '@/lib/ai/profiles'
import { readOpenAIChatStream } from '@/lib/ai/stream'
import {
  createSessionChatMessage,
  deleteSessionChatMessage,
  listSessionChatMessages,
  updateSessionChatMessage,
} from '@/lib/ai/storage'
import type {
  AITool,
  AIToolCall,
  OpenAIChatMessage,
  OpenAIChatRequest,
  SessionChatSendOptions,
  SessionChatSendResult,
} from '@/lib/ai/types'

function buildSystemMessage(options: {
  sessionName: string
  sessionDescription?: string
  contextPacket?: unknown
  toolsEnabled?: boolean
}): OpenAIChatMessage {
  const parts = [
    'You are the Data Compare session copilot.',
    'Use only the provided session context and chat history.',
    'Do not claim access to anything outside this session.',
    'Some source data is intentionally truncated. Do not assume omitted data is absent.',
    'If context is missing, stale, incomplete, or truncated, say that clearly.',
    'Be precise, concise, and technical.',
    'Ground observations in the provided data.',
    'Separate facts from suggestions.',
    'Do not invent metrics, warning rules, source behavior, root causes, or hidden data.',
    options.toolsEnabled
      ? 'You may propose changes to this session by calling the provided tools. Each proposal is shown to the user for confirmation before it is applied. Do not claim a change has already happened.'
      : 'Do not claim you changed anything. You cannot edit IndexedDB, sources, mappings, metrics, warning rules, or session settings.',
    options.toolsEnabled
      ? 'Only propose actions that are clearly justified by the session context. If unsure, ask the user instead of creating entities.'
      : 'Your answers are advisory only, not automatic actions.',
    'Use short sections when helpful: Summary, Evidence, Risks, Next steps.',
    'Use markdown tables only when they make the answer clearer.',
    options.toolsEnabled
      ? 'When suggesting metrics, rules, or charts, prefer creating them with a tool call so the user can apply them in one click.'
      : 'When suggesting metrics, rules, or next actions, label them as suggestions.',
    `Session name: ${options.sessionName}`,
    `Session description: ${options.sessionDescription?.trim() || 'Not provided.'}`,
  ]

  if (options.contextPacket !== undefined) {
    const context = typeof options.contextPacket === 'string'
      ? options.contextPacket
      : JSON.stringify(options.contextPacket, null, 2)
    parts.push(`Session context:\n${context}`)
  }

  return {
    role: 'system',
    content: parts.join('\n\n'),
  }
}

function toOpenAIChatMessages(systemMessage: OpenAIChatMessage, messages: Awaited<ReturnType<typeof listSessionChatMessages>>): OpenAIChatMessage[] {
  return [
    systemMessage,
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ]
}

function buildRequestBody(messages: OpenAIChatMessage[], model: string, tools?: AITool[]): OpenAIChatRequest {
  const body: OpenAIChatRequest = {
    model,
    stream: tools === undefined,
    messages,
  }
  if (tools) {
    body.tools = tools
  }
  return body
}

function buildRequestHeaders(baseUrl: string, apiKey: string, streaming: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: streaming ? 'text/event-stream' : 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  try {
    const url = new URL(baseUrl)
    if (url.hostname === 'openrouter.ai') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
      headers['X-OpenRouter-Title'] = 'Data Compare'
    }
  } catch {
    // ignore invalid URL here; profile validation handles it elsewhere
  }

  return headers
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: { message?: string }; message?: string }
    return data.error?.message || data.message || `Request failed with HTTP ${response.status}`
  } catch {
    const text = await response.text()
    return text || `Request failed with HTTP ${response.status}`
  }
}

function isToolCallArray(value: unknown): value is AIToolCall[] {
  if (!Array.isArray(value)) return false
  return value.every((item) => (
    typeof item === 'object'
    && item !== null
    && typeof (item as AIToolCall).id === 'string'
    && (item as AIToolCall).type === 'function'
    && typeof (item as AIToolCall).function?.name === 'string'
    && typeof (item as AIToolCall).function?.arguments === 'string'
  ))
}

function parseToolCallsFromResponse(data: unknown): { content: string | null; toolCalls: AIToolCall[] } {
  if (typeof data !== 'object' || data === null) {
    return { content: null, toolCalls: [] }
  }

  const choices = (data as Record<string, unknown>).choices
  if (!Array.isArray(choices) || choices.length === 0) {
    return { content: null, toolCalls: [] }
  }

  const message = (choices[0] as Record<string, unknown>)?.message as Record<string, unknown> | undefined
  if (!message) {
    return { content: null, toolCalls: [] }
  }

  const content = typeof message.content === 'string' ? message.content : null
  const rawToolCalls = message.tool_calls

  return {
    content,
    toolCalls: isToolCallArray(rawToolCalls) ? rawToolCalls : [],
  }
}

async function handleNonStreamingResponse(
  response: Response,
  assistantMessageId: string,
): Promise<{ content: string; toolCalls: AIToolCall[] }> {
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new Error('Invalid JSON response from model')
  }

  const parsed = parseToolCallsFromResponse(data)

  if (!parsed.content && parsed.toolCalls.length === 0) {
    throw new Error('Model returned an empty response')
  }

  const content = parsed.content ?? ''
  const existing = await db.sessionChatMessages.get(assistantMessageId)
  await updateSessionChatMessage(assistantMessageId, {
    content,
    meta: { ...existing?.meta, toolCalls: parsed.toolCalls },
  })

  return { content, toolCalls: parsed.toolCalls }
}

export async function sendSessionChatMessage(options: SessionChatSendOptions): Promise<SessionChatSendResult> {
  throwIfAborted(options.signal)

  const session = await db.sessions.get(options.sessionId)
  if (!session) throw new Error('Session not found')

  const profile = await getAIProfile(options.profileId)
  const resolvedContextPacket = options.contextPacket ?? await buildDefaultSessionContext(options.sessionId)

  const userMessage = await createSessionChatMessage({
    sessionId: options.sessionId,
    role: 'user',
    content: options.userText.trim(),
    meta: {
      profileId: profile.id,
      model: profile.model,
    },
  })

  const toolsEnabled = options.tools !== undefined && options.tools.length > 0

  const assistantMessage = await createSessionChatMessage({
    sessionId: options.sessionId,
    role: 'assistant',
    content: '',
    meta: {
      profileId: profile.id,
      model: profile.model,
      contextWindow: options.contextPacket === undefined ? 'default' : 'custom',
    },
  })

  try {
    const history = await listSessionChatMessages(options.sessionId)
    const systemMessage = buildSystemMessage({
      sessionName: session.name,
      sessionDescription: session.description,
      contextPacket: resolvedContextPacket,
      toolsEnabled,
    })
    const messages = toOpenAIChatMessages(systemMessage, history.filter((message) => message.id !== assistantMessage.id))
    const body = buildRequestBody(messages, profile.model, options.tools)

    const response = await fetch(profile.baseUrl, {
      method: 'POST',
      headers: buildRequestHeaders(profile.baseUrl, profile.apiKey, body.stream),
      body: JSON.stringify(body),
      signal: options.signal,
    })

    if (!response.ok) {
      throw new Error(await readErrorMessage(response))
    }

    if (toolsEnabled) {
      const { content, toolCalls } = await handleNonStreamingResponse(response, assistantMessage.id)
      const saved = await db.sessionChatMessages.get(assistantMessage.id)

      return {
        profile,
        userMessage,
        assistantMessage: saved ?? { ...assistantMessage, content },
        toolCalls,
      }
    }

    const content = await readOpenAIChatStream(response, {
      signal: options.signal,
      onDelta: async (text) => {
        await updateSessionChatMessage(assistantMessage.id, { content: text })
        options.onDelta?.(text)
      },
    })

    if (!content) {
      await deleteSessionChatMessage(assistantMessage.id)
      throw new Error('Model returned an empty response')
    }

    const finalAssistantMessage = {
      ...assistantMessage,
      content,
    }

    return {
      profile,
      userMessage,
      assistantMessage: finalAssistantMessage,
    }
  } catch (error) {
    const savedAssistantMessage = await db.sessionChatMessages.get(assistantMessage.id)
    if (!savedAssistantMessage?.content) {
      await deleteSessionChatMessage(assistantMessage.id)
    }
    throw error
  }
}
