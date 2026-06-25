import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, createSession, saveAIProfile } from '@/db'
import { createAbortError } from '@/lib/abort'
import { sendSessionChatMessage } from '@/lib/ai/client'

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.restoreAllMocks()
})

describe('sendSessionChatMessage', () => {
  it('sends chat completions request and persists streamed reply', async () => {
    const session = await createSession({
      name: 'Ads session',
      description: 'Track spend vs donations.',
    })
    const profile = await saveAIProfile({
      name: 'OpenCode Go',
      baseUrl: 'https://opencode.ai/zen/go/v1/chat/completions',
      apiKey: 'secret-key',
      model: 'deepseek-v4-flash',
      transport: 'direct',
    })

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    const onDelta = vi.fn()
    const result = await sendSessionChatMessage({
      sessionId: session.id,
      profileId: profile.id,
      userText: 'Summarize this session',
      contextPacket: { latestWarningCount: 0 },
      onDelta,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://opencode.ai/zen/go/v1/chat/completions')

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key')
    expect((init.headers as Record<string, string>)['X-Data-Compare-Transport']).toBeUndefined()

    const body = JSON.parse(String(init.body)) as {
      model: string
      stream: boolean
      messages: Array<{ role: string; content: string }>
    }
    expect(body.model).toBe('deepseek-v4-flash')
    expect(body.stream).toBe(true)
    expect(body.messages[0]?.role).toBe('system')
    expect(body.messages[0]?.content).toContain('Track spend vs donations.')
    expect(body.messages.at(-1)?.content).toBe('Summarize this session')

    expect(onDelta).toHaveBeenNthCalledWith(1, 'Hello')
    expect(onDelta).toHaveBeenNthCalledWith(2, 'Hello world')

    expect(result.assistantMessage.content).toBe('Hello world')

    const messages = await db.sessionChatMessages.where('sessionId').equals(session.id).toArray()
    expect(messages).toHaveLength(2)
    expect(messages[0]?.role).toBe('user')
    expect(messages[1]?.role).toBe('assistant')
    expect(messages[1]?.content).toBe('Hello world')
  })

  it('adds OpenRouter attribution headers for openrouter.ai', async () => {
    const session = await createSession({ name: 'OpenRouter session' })
    const profile = await saveAIProfile({
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: 'openrouter-key',
      model: 'meta-llama/llama-3.3-8b-instruct:free',
      transport: 'direct',
    })

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )

    await sendSessionChatMessage({
      sessionId: session.id,
      profileId: profile.id,
      userText: 'hi',
    })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['HTTP-Referer']).toBe('http://localhost:3000')
    expect((init.headers as Record<string, string>)['X-OpenRouter-Title']).toBe('Data Compare')
  })

  it('cleans up empty assistant placeholder on request failure', async () => {
    const session = await createSession({ name: 'Fail session' })
    const profile = await saveAIProfile({
      name: 'Direct',
      baseUrl: 'https://example.com/v1/chat/completions',
      apiKey: 'key',
      model: 'model',
      transport: 'direct',
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(
      sendSessionChatMessage({
        sessionId: session.id,
        profileId: profile.id,
        userText: 'hello',
      }),
    ).rejects.toThrow('Unauthorized')

    const messages = await db.sessionChatMessages.where('sessionId').equals(session.id).toArray()
    expect(messages).toHaveLength(1)
    expect(messages[0]?.role).toBe('user')
  })

  it('stops before writing when already aborted', async () => {
    const controller = new AbortController()
    controller.abort(createAbortError())

    await expect(
      sendSessionChatMessage({
        sessionId: 'missing',
        userText: 'hello',
        signal: controller.signal,
      }),
    ).rejects.toThrow(/aborted/i)

    expect(await db.sessionChatMessages.toArray()).toHaveLength(0)
  })
})
