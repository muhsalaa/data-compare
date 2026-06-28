import type { AIProfile, SessionChatMessage, SessionChatRole, WarningSeverity } from '@/db'

export type OpenAIChatRole = SessionChatRole

export interface OpenAIChatMessage {
  role: OpenAIChatRole
  content: string
}

export interface OpenAIChatRequest {
  model: string
  stream: boolean
  messages: OpenAIChatMessage[]
  tools?: AITool[]
}

export interface AITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: object
  }
}

export interface AIToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface OpenAIChatChoiceDelta {
  content?: string | Array<{ type?: string; text?: string }>
}

export interface OpenAIChatChunk {
  choices?: Array<{
    delta?: OpenAIChatChoiceDelta
    finish_reason?: string | null
  }>
  error?: {
    message?: string
  }
}

export interface SessionChatSendOptions {
  sessionId: string
  profileId?: string
  userText: string
  contextPacket?: unknown
  signal?: AbortSignal
  onDelta?: (text: string) => void
  tools?: AITool[]
}

export interface SessionChatSendResult {
  profile: AIProfile
  userMessage: SessionChatMessage
  assistantMessage: SessionChatMessage
  toolCalls?: AIToolCall[]
}

export type CopilotAction =
  | { type: 'create_derived_metric'; payload: { label: string; key: string; formula: string } }
  | { type: 'create_warning_rule'; payload: { name: string; expression: string; severity: WarningSeverity; enabled?: boolean } }
  | { type: 'create_chart'; payload: { name: string; series: string[] } }

export interface ActionResult {
  ok: boolean
  action: CopilotAction
  error?: string
  createdIds?: string[]
}
