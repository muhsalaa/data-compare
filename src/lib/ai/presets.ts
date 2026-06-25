export interface SessionCopilotPreset {
  id: string
  label: string
  prompt: string
}

export const SESSION_COPILOT_PRESETS: SessionCopilotPreset[] = [
  {
    id: 'summary',
    label: 'Summarize health',
    prompt: 'Summarize this session health in plain language. Call out what looks healthy, risky, or missing.',
  },
  {
    id: 'anomalies',
    label: 'Explain anomalies',
    prompt: 'Explain any recent anomalies, warning spikes, missing values, or suspicious patterns in this session.',
  },
  {
    id: 'trend',
    label: 'Recent trend',
    prompt: 'Compare the recent trend in this session and tell me what changed most.',
  },
  {
    id: 'rules',
    label: 'Suggest rules',
    prompt: 'Suggest warning rules I should add for this session, based on the current setup and data shape.',
  },
]
