import { beforeEach, describe, expect, it } from 'vitest'
import { db, saveAIProfile } from '@/db'
import { getAIProfile, normalizeChatEndpoint } from '@/lib/ai/profiles'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('ai profiles', () => {
  it('normalizes trailing slashes', () => {
    expect(normalizeChatEndpoint('https://example.com/v1/chat/completions///')).toBe(
      'https://example.com/v1/chat/completions',
    )
  })

  it('loads latest enabled profile by default', async () => {
    await saveAIProfile({
      name: 'Older',
      baseUrl: 'https://example.com/v1/chat/completions',
      apiKey: 'key-1',
      model: 'model-1',
      transport: 'direct',
    })

    const latest = await saveAIProfile({
      name: 'Latest',
      baseUrl: 'https://example.com/v1/chat/completions/',
      apiKey: 'key-2',
      model: 'model-2',
      transport: 'relay',
    })

    const profile = await getAIProfile()
    expect(profile.id).toBe(latest.id)
    expect(profile.baseUrl).toBe('https://example.com/v1/chat/completions')
  })

  it('loads a specific enabled profile', async () => {
    const profile = await saveAIProfile({
      name: 'Chosen',
      baseUrl: 'https://example.com/v1/chat/completions',
      apiKey: 'key',
      model: 'model',
      transport: 'direct',
    })

    const found = await getAIProfile(profile.id)
    expect(found.id).toBe(profile.id)
  })

  it('rejects a disabled profile', async () => {
    const profile = await saveAIProfile({
      name: 'Disabled',
      baseUrl: 'https://example.com/v1/chat/completions',
      apiKey: 'key',
      model: 'model',
      transport: 'direct',
      enabled: false,
    })

    await expect(getAIProfile(profile.id)).rejects.toThrow('disabled')
  })
})
