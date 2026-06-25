import { beforeEach, describe, expect, it } from 'vitest'
import { db, saveAIProfile, validateAIProfile } from '../index'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('AI profile storage', () => {
  it('validates required fields', () => {
    expect(
      validateAIProfile({
        name: '',
        baseUrl: '',
        apiKey: '',
        model: '',
      }),
    ).toBe('Profile name is required')
  })

  it('persists a profile', async () => {
    const profile = await saveAIProfile({
      name: 'Default profile',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: 'secret-key',
      model: 'openai/gpt-4.1-mini',
      transport: 'direct',
    })

    const found = await db.aiProfiles.get(profile.id)
    expect(found).toBeDefined()
    expect(found!.name).toBe('Default profile')
    expect(found!.transport).toBe('direct')
  })

  it('updates an existing profile in place', async () => {
    const profile = await saveAIProfile({
      name: 'Default profile',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: 'secret-key',
      model: 'openai/gpt-4.1-mini',
      transport: 'direct',
    })

    const updated = await saveAIProfile({
      id: profile.id,
      name: 'Relay profile',
      baseUrl: 'https://example.com/api/chat',
      apiKey: 'new-secret-key',
      model: 'gpt-4.1-mini',
      transport: 'relay',
    })

    expect(updated.id).toBe(profile.id)
    expect(updated.createdAt).toBe(profile.createdAt)

    const allProfiles = await db.aiProfiles.toArray()
    expect(allProfiles).toHaveLength(1)
    expect(allProfiles[0].name).toBe('Relay profile')
    expect(allProfiles[0].transport).toBe('relay')
  })
})
