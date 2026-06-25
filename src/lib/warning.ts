import { math, normalizeExpr, normalizeKey, extractVariables } from './formula'

// ── Warning rule evaluation ──────────────────────────────────────

/**
 * Evaluate a warning rule expression against a scope.
 * Supports: + - * / > >= < <= == != && || ()
 *
 * If a variable referenced in the expression is null or missing
 * in the scope, the rule evaluates to false (not triggered).
 * Only numeric values are passed to math.js for evaluation.
 * Returns true if the warning condition is met, false otherwise.
 */
export function evaluateWarning(
  expression: string,
  scope: Record<string, number | null>,
): boolean {
  try {
    const safeExpr = normalizeExpr(expression)
    const referencedVars = extractVariables(safeExpr)

    // Build normalized scope, detecting null/missing for referenced vars
    const normalizedScope: Record<string, number> = {}

    for (const [key, val] of Object.entries(scope)) {
      const normKey = normalizeKey(key)

      // If a referenced variable is null or missing, return false
      if (referencedVars.includes(normKey) && (val === null || val === undefined)) {
        return false
      }

      // Only pass numeric values to the evaluator
      if (val !== null && val !== undefined) {
        normalizedScope[normKey] = val
      }
    }

    // Check for missing referenced variables not in scope at all
    for (const name of referencedVars) {
      if (!(name in normalizedScope)) {
        return false
      }
    }

    const result = math.evaluate(safeExpr, normalizedScope)

    if (typeof result === 'boolean') return result
    return result === 1 || (typeof result === 'number' && result !== 0)
  } catch {
    return false
  }
}

/**
 * Validate a warning rule expression.
 * Allows: + - * / > >= < <= == != && || ( ) and identifiers.
 */
export function validateWarning(expression: string): string | null {
  if (!expression.trim()) return 'Expression cannot be empty'

  // Must contain at least one comparison or logical operator
  if (!/[<>=!&|]/.test(expression)) {
    return 'Warning expressions must include a comparison (>, <, ==, etc.) or logical operator (&&, ||)'
  }

  // Check for forbidden characters
  if (/[^a-zA-Z0-9_.\s+\-*/()[\]{},<>=!&|]/.test(expression)) {
    return 'Expression contains invalid characters'
  }

  // Check for function calls
  if (/\b[a-zA-Z_][a-zA-Z0-9_]*\(/.test(expression)) {
    return 'Function calls are not allowed'
  }

  // Try parsing
  try {
    math.parse(expression)
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid expression syntax'
  }

  return null
}
