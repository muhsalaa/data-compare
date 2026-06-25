import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import {
  clearSessionChatMessages,
  createSessionChatMessage,
  listSessionChatMessages,
  updateSessionChatMessage,
} from '@/lib/ai/storage'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('ai chat storage', () => {
  it('creates, lists, updates, and clears session messages', async () => {
    const user = await createSessionChatMessage({
      sessionId: 'session-1',
      role: 'user',
      content: 'hello',
    })

    const assistant = await createSessionChatMessage({
      sessionId: 'session-1',
      role: 'assistant',
      content: '',
    })

    const listed = await listSessionChatMessages('session-1')
    expect(listed).toHaveLength(2)
    expect(listed[0].id).toBe(user.id)
    expect(listed[1].id).toBe(assistant.id)

    await updateSessionChatMessage(assistant.id, { content: 'world' })
    const updated = await db.sessionChatMessages.get(assistant.id)
    expect(updated?.content).toBe('world')

    await clearSessionChatMessages('session-1')
    expect(await listSessionChatMessages('session-1')).toHaveLength(0)
  })
})
