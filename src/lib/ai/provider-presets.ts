export interface AIProviderPreset {
  id: string
  label: string
  baseUrls: string[]
  suggestedModels: string[]
  defaultModel?: string
  helperText?: string
}

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: 'opencode-go',
    label: 'OpenCode Go',
    baseUrls: ['https://opencode.ai/zen/go/v1/chat/completions'],
    suggestedModels: [
      'deepseek-v4-flash',
      'deepseek-v4-pro',
      'kimi-k2.7',
      'kimi-k2.6',
      'glm-5.2',
      'glm-5.1',
      'mimo-v2.5',
      'mimo-v2.5-pro',
      'minimax-m3',
      'minimax-m2.7',
      'qwen3.7-max',
      'qwen3.7-plus',
      'qwen3.6-plus',
    ],
    defaultModel: 'deepseek-v4-flash',
    helperText: 'Suggested OpenCode Go models available below.',
  },
]

export function detectAIProviderPreset(baseUrl: string): AIProviderPreset | null {
  const normalizedBaseUrl = baseUrl.trim()
  if (!normalizedBaseUrl) return null

  return AI_PROVIDER_PRESETS.find((preset) =>
    preset.baseUrls.some((candidate) => candidate === normalizedBaseUrl),
  ) ?? null
}
