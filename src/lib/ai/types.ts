import type { AIProfile, SessionChatMessage, SessionChatRole } from '@/db'

export type OpenAIChatRole = SessionChatRole

export interface OpenAIChatMessage {
  role: OpenAIChatRole
  content: string
}

export interface OpenAIChatRequest {
  model: string
  stream: true
  messages: OpenAIChatMessage[]
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
}

export interface SessionChatSendResult {
  profile: AIProfile
  userMessage: SessionChatMessage
  assistantMessage: SessionChatMessage
}
