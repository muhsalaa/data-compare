import { create, all } from 'mathjs/number'

export const math = create(all, { number: 'number' })

// ── Shared helpers ───────────────────────────────────────────────

/**
 * Normalize a dotted variable name so math.js can use it as a key.
 * `ads.spend` → `ads_dot_spend`
 */
export function normalizeKey(key: string): string {
  return key.replace(/\./g, '_dot_')
}

/**
 * Normalize an expression by replacing dotted variable names with
 * their underscore-safe equivalents.
 */
export function normalizeExpr(expr: string): string {
  return expr.replace(
    /([a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_.]*)/g,
    (match) => {
      if (/^\d/.test(match)) return match
      return match.replace(/\./g, '_dot_')
    },
  )
}

/**
 * Normalize a scope object so its dot-keys match the normalized expression.
 */
export function normalizeScope(
  scope: Record<string, number | null>,
): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const [key, val] of Object.entries(scope)) {
    result[normalizeKey(key)] = val
  }
  return result
}

/**
 * Extract variable names from an expression.
 * Filters out math builtins (sin, cos, pi, etc.).
 */
export function extractVariables(expr: string): string[] {
  const tokens = expr.match(/[a-zA-Z_][a-zA-Z0-9_.]*/g)
  if (!tokens) return []

  const builtins = new Set([
    'sin', 'cos', 'tan', 'log', 'sqrt', 'abs', 'pi', 'e', 'true', 'false',
    'or', 'and', 'xor', 'not',
  ])
  return [...new Set(tokens.filter((t) => !builtins.has(t)))]
}

// ── Formula evaluation (derived metrics) ─────────────────────────

/**
 * Safely evaluate a formula string against a scope of variable values.
 * Only allows basic arithmetic: + - * / () and numbers.
 * Returns the result as a number, or null on error.
 */
export function evaluateFormula(
  formula: string,
  scope: Record<string, number | null>,
): number | null {
  try {
    const safeFormula = normalizeExpr(formula)
    const safeScope = normalizeScope(scope)

    // Check for null operands
    for (const name of extractVariables(safeFormula)) {
      if (safeScope[name] === null || safeScope[name] === undefined) {
        return null
      }
    }

    const result = math.evaluate(safeFormula, safeScope)

    if (typeof result === 'number' && Number.isFinite(result)) {
      return result
    }
    return null
  } catch {
    return null
  }
}

/**
 * Validate that a formula only uses permitted operators:
 * + - * / ( ) and field references.
 * Returns null if valid, error message string if invalid.
 */
export function validateFormula(formula: string): string | null {
  if (!formula.trim()) return 'Formula cannot be empty'

  // Check for forbidden operators
  if (/[<>=!&|^%]/.test(formula)) {
    return 'Only + - * / ( ) operators are allowed'
  }

  // Check for function calls
  if (/\b[a-zA-Z_][a-zA-Z0-9_]*\(/.test(formula)) {
    return 'Function calls are not allowed in formulas'
  }

  // Check for invalid characters
  if (/[^a-zA-Z0-9_.\s+\-*/()[\]{},]/.test(formula)) {
    return 'Formula contains invalid characters'
  }

  // Try parsing to check syntax
  try {
    const node = math.parse(formula)
    const invalid = findInvalidNodes(node)
    if (invalid) return `Not allowed in formula: ${invalid}`
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid formula syntax'
  }

  return null
}

function findInvalidNodes(node: unknown): string | null {
  if (typeof node !== 'object' || node === null) return null
  const n = node as Record<string, unknown>

  const allowed = new Set([
    'OperatorNode',
    'ConstantNode',
    'SymbolNode',
    'ParenthesisNode',
    'FunctionNode',
    'AccessorNode',
  ])

  if (typeof n.type === 'string' && !allowed.has(n.type)) return n.type

  if (Array.isArray(n.args)) {
    for (const child of n.args) {
      const result = findInvalidNodes(child)
      if (result) return result
    }
  }
  if (n.content && typeof n.content === 'object') {
    return findInvalidNodes(n.content)
  }

  return null
}
