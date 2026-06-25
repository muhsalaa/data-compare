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
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrls: ['https://openrouter.ai/api/v1/chat/completions'],
    suggestedModels: [
      'openai/gpt-4.1-mini',
      'meta-llama/llama-3.3-8b-instruct:free',
      'google/gemma-2-9b-it:free',
    ],
    defaultModel: 'openai/gpt-4.1-mini',
    helperText: 'Use an exact OpenRouter model ID.',
  },
]

export function detectAIProviderPreset(baseUrl: string): AIProviderPreset | null {
  const normalizedBaseUrl = baseUrl.trim()
  if (!normalizedBaseUrl) return null

  return AI_PROVIDER_PRESETS.find((preset) =>
    preset.baseUrls.some((candidate) => candidate === normalizedBaseUrl),
  ) ?? null
}
