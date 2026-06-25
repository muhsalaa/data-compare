import { db, newId, nowISO, type SessionChatMessage, type SessionChatRole } from '@/db'

export async function listSessionChatMessages(sessionId: string): Promise<SessionChatMessage[]> {
  return db.sessionChatMessages.where('sessionId').equals(sessionId).sortBy('createdAt')
}

export async function createSessionChatMessage(input: {
  sessionId: string
  role: SessionChatRole
  content: string
  meta?: SessionChatMessage['meta']
}): Promise<SessionChatMessage> {
  const message: SessionChatMessage = {
    id: newId(),
    sessionId: input.sessionId,
    role: input.role,
    content: input.content,
    createdAt: nowISO(),
    meta: input.meta,
  }
  await db.sessionChatMessages.add(message)
  return message
}

export async function updateSessionChatMessage(
  id: string,
  changes: Partial<Pick<SessionChatMessage, 'content' | 'meta'>>,
): Promise<void> {
  await db.sessionChatMessages.update(id, changes)
}

export async function deleteSessionChatMessage(id: string): Promise<void> {
  await db.sessionChatMessages.delete(id)
}

export async function clearSessionChatMessages(sessionId: string): Promise<void> {
  const ids = await db.sessionChatMessages.where('sessionId').equals(sessionId).primaryKeys()
  await db.sessionChatMessages.bulkDelete(ids)
}
