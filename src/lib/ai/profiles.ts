import { db, type AIProfile } from '@/db'

export function normalizeChatEndpoint(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

export function assertUsableAIProfile(profile: AIProfile | undefined): AIProfile {
  if (!profile) throw new Error('No AI profile found')
  if (!profile.enabled) throw new Error('Selected AI profile is disabled')
  if (!profile.baseUrl.trim()) throw new Error('AI profile base URL is required')
  if (!profile.apiKey.trim()) throw new Error('AI profile API key is required')
  if (!profile.model.trim()) throw new Error('AI profile model is required')
  return {
    ...profile,
    baseUrl: normalizeChatEndpoint(profile.baseUrl),
    apiKey: profile.apiKey.trim(),
    model: profile.model.trim(),
  }
}

export async function getAIProfile(profileId?: string): Promise<AIProfile> {
  const profile = profileId
    ? await db.aiProfiles.get(profileId)
    : await db.aiProfiles.orderBy('updatedAt').reverse().filter((item) => item.enabled).first()

  return assertUsableAIProfile(profile)
}
