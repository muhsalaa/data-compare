import type { WarningSeverity } from '@/db'
import type { AITool } from '@/lib/ai/types'

export interface CreateDerivedMetricArgs {
  label: string
  key: string
  formula: string
}

export interface CreateWarningRuleArgs {
  name: string
  expression: string
  severity: WarningSeverity
  enabled?: boolean
}

export interface CreateChartArgs {
  name: string
  series: string[]
}

export const COPILOT_TOOLS: AITool[] = [
  {
    type: 'function',
    function: {
      name: 'create_derived_metric',
      description: 'Create a derived metric that computes a value from mapped fields and other derived metrics.',
      parameters: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description: 'Human-readable label, e.g. "Cost Per Click".',
          },
          key: {
            type: 'string',
            description: 'Unique bare key for this metric, e.g. "cpc". Lowercase letters, numbers, underscore. No dots.',
          },
          formula: {
            type: 'string',
            description: 'Math expression using + - * / ( ) and field references like "ads.spend / ads.clicks".',
          },
        },
        required: ['label', 'key', 'formula'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_warning_rule',
      description: 'Create a warning rule that evaluates an expression against current metric values.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Human-readable rule name, e.g. "Low ROAS".',
          },
          expression: {
            type: 'string',
            description: 'Boolean expression using comparisons (>, <, ==, etc.), logical operators (&&, ||), and field/metric references. Example: "roas < 1.2 && ads.spend > 100"',
          },
          severity: {
            type: 'string',
            enum: ['info', 'warning', 'critical'],
            description: 'Severity level for this rule.',
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the rule should be enabled immediately. Defaults to true.',
          },
        },
        required: ['name', 'expression', 'severity'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_chart',
      description: 'Create a chart with a set of series references.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Chart title, e.g. "Spend vs ROAS".',
          },
          series: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of series references such as "ads.spend" or "roas".',
          },
        },
        required: ['name', 'series'],
        additionalProperties: false,
      },
    },
  },
]
