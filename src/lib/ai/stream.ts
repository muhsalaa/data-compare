import { createAbortError, throwIfAborted } from '@/lib/abort'
import type { OpenAIChatChunk } from '@/lib/ai/types'

function extractDeltaText(chunk: OpenAIChatChunk): string {
  const content = chunk.choices?.[0]?.delta?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === 'text' || part.text ? part.text ?? '' : ''))
      .join('')
  }
  return ''
}

function parseSseBlock(block: string): string | null {
  const payload = block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')

  if (!payload) return null
  if (payload === '[DONE]') return null

  let chunk: OpenAIChatChunk
  try {
    chunk = JSON.parse(payload) as OpenAIChatChunk
  } catch {
    return null
  }

  if (chunk.error?.message) {
    throw new Error(chunk.error.message)
  }

  return extractDeltaText(chunk)
}

export async function readOpenAIChatStream(response: Response, options?: {
  signal?: AbortSignal
  onDelta?: (text: string) => void | Promise<void>
}): Promise<string> {
  if (!response.body) {
    throw new Error('Streaming response body missing')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    throwIfAborted(options?.signal)

    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')

    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''

    for (const block of blocks) {
      const delta = parseSseBlock(block)
      if (!delta) continue
      fullText += delta
      await options?.onDelta?.(fullText)
    }
  }

  buffer += decoder.decode()
  const trailingDelta = parseSseBlock(buffer.replace(/\r/g, ''))
  if (trailingDelta) {
    fullText += trailingDelta
    await options?.onDelta?.(fullText)
  }

  if (options?.signal?.aborted) {
    throw options.signal.reason instanceof Error ? options.signal.reason : createAbortError()
  }

  return fullText
}
