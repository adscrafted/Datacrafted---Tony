/**
 * Formula Parser
 *
 * Safe formula parser for calculating custom metrics using formulas like:
 * - "(Revenue - Cost) / Revenue * 100" (Profit Margin)
 * - "Revenue / Ad_Spend" (ROAS)
 * - "SUM(Revenue) / SUM(Orders)" (AOV)
 *
 * Features:
 * - Basic operations: +, -, *, /, parentheses
 * - Column references: Direct column names or [Column Names with Spaces]
 * - Aggregate functions: SUM(), AVG(), COUNT(), MIN(), MAX()
 * - Constants: Numbers (100, 0.5, etc.)
 * - Safety: Prevents code injection, limits complexity
 */

import type { DataRow } from '@/lib/store'
import { parseNumericValue } from './data-calculations'

// ============================================================================
// Security Constants
// ============================================================================

const MAX_FORMULA_LENGTH = 500
const MAX_OPERATIONS = 50
const MAX_FUNCTION_DEPTH = 5
const ALLOWED_FUNCTIONS = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'ABS', 'ROUND', 'SQRT']

// ============================================================================
// Types
// ============================================================================

export interface FormulaToken {
  type: 'number' | 'column' | 'operator' | 'function' | 'paren'
  value: string
  position: number
}

export interface FormulaParseResult {
  success: boolean
  tokens?: FormulaToken[]
  error?: string
  errorPosition?: number
}

export interface FormulaEvaluationResult {
  success: boolean
  value?: number
  error?: string
  usedColumns?: string[]
}

export interface FormulaContext {
  row?: DataRow
  aggregatedData?: Map<string, number>
  allData?: DataRow[]
}

// ============================================================================
// Column Name Normalization
// ============================================================================

/**
 * Normalize column name to match data columns
 * Handles spaces, special characters, case variations
 */
export function normalizeColumnName(name: string): string {
  // Remove brackets if present
  let normalized = name.replace(/^\[|\]$/g, '').trim()

  // Common patterns:
  // "Total Sales" -> "Total Sales" (preserve spaces)
  // "total_sales" -> "total_sales" (preserve underscores)
  // "Total-Sales" -> "Total-Sales" (preserve hyphens)

  return normalized
}

/**
 * Find matching column in data, handling various naming conventions
 */
export function findMatchingColumn(columnRef: string, availableColumns: string[]): string | null {
  const normalized = normalizeColumnName(columnRef)

  // Exact match
  if (availableColumns.includes(normalized)) {
    return normalized
  }

  // Case-insensitive match
  const lowerNormalized = normalized.toLowerCase()
  const caseInsensitiveMatch = availableColumns.find(col => col.toLowerCase() === lowerNormalized)
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch
  }

  // Try with spaces converted to underscores
  const underscoreVersion = normalized.replace(/\s+/g, '_')
  if (availableColumns.includes(underscoreVersion)) {
    return underscoreVersion
  }

  // Try with underscores converted to spaces
  const spaceVersion = normalized.replace(/_/g, ' ')
  if (availableColumns.includes(spaceVersion)) {
    return spaceVersion
  }

  return null
}

// ============================================================================
// Tokenization
// ============================================================================

/**
 * Tokenize formula into parseable components
 */
export function tokenizeFormula(formula: string): FormulaParseResult {
  // Security check: Formula length
  if (formula.length > MAX_FORMULA_LENGTH) {
    return {
      success: false,
      error: `Formula too long (max ${MAX_FORMULA_LENGTH} characters)`
    }
  }

  // Security check: No dangerous characters
  const dangerousPattern = /[;`\\${}]/
  if (dangerousPattern.test(formula)) {
    return {
      success: false,
      error: 'Formula contains invalid characters'
    }
  }

  const tokens: FormulaToken[] = []
  let i = 0

  while (i < formula.length) {
    const char = formula[i]

    // Skip whitespace
    if (/\s/.test(char)) {
      i++
      continue
    }

    // Numbers (including decimals)
    if (/\d/.test(char)) {
      let numStr = ''
      while (i < formula.length && /[\d.]/.test(formula[i])) {
        numStr += formula[i]
        i++
      }

      // Validate number
      const num = parseFloat(numStr)
      if (isNaN(num) || !isFinite(num)) {
        return {
          success: false,
          error: `Invalid number: ${numStr}`,
          errorPosition: i - numStr.length
        }
      }

      tokens.push({ type: 'number', value: numStr, position: i - numStr.length })
      continue
    }

    // Operators
    if (['+', '-', '*', '/', '%'].includes(char)) {
      tokens.push({ type: 'operator', value: char, position: i })
      i++
      continue
    }

    // Parentheses
    if (['(', ')'].includes(char)) {
      tokens.push({ type: 'paren', value: char, position: i })
      i++
      continue
    }

    // Bracketed column names [Column Name]
    if (char === '[') {
      let columnName = ''
      i++ // Skip opening bracket
      const startPos = i

      while (i < formula.length && formula[i] !== ']') {
        columnName += formula[i]
        i++
      }

      if (i >= formula.length) {
        return {
          success: false,
          error: 'Unclosed bracket in column reference',
          errorPosition: startPos - 1
        }
      }

      i++ // Skip closing bracket
      tokens.push({ type: 'column', value: columnName, position: startPos - 1 })
      continue
    }

    // Functions and column names (alphanumeric + underscore + hyphen)
    if (/[a-zA-Z_]/.test(char)) {
      let identifier = ''
      const startPos = i

      while (i < formula.length && /[a-zA-Z0-9_-]/.test(formula[i])) {
        identifier += formula[i]
        i++
      }

      // Check if it's a function (followed by opening parenthesis)
      if (i < formula.length && formula[i] === '(') {
        const upperIdentifier = identifier.toUpperCase()

        // Security check: Only allowed functions
        if (!ALLOWED_FUNCTIONS.includes(upperIdentifier)) {
          return {
            success: false,
            error: `Unknown function: ${identifier}. Allowed: ${ALLOWED_FUNCTIONS.join(', ')}`,
            errorPosition: startPos
          }
        }

        tokens.push({ type: 'function', value: upperIdentifier, position: startPos })
        tokens.push({ type: 'paren', value: '(', position: i })
        i++ // Skip opening parenthesis
      } else {
        // It's a column name
        tokens.push({ type: 'column', value: identifier, position: startPos })
      }

      continue
    }

    // Unknown character
    return {
      success: false,
      error: `Unexpected character: '${char}'`,
      errorPosition: i
    }
  }

  // Validate parentheses balance
  let parenBalance = 0
  for (const token of tokens) {
    if (token.type === 'paren') {
      parenBalance += token.value === '(' ? 1 : -1
      if (parenBalance < 0) {
        return {
          success: false,
          error: 'Mismatched parentheses (extra closing)',
          errorPosition: token.position
        }
      }
    }
  }

  if (parenBalance !== 0) {
    return {
      success: false,
      error: 'Mismatched parentheses (unclosed)'
    }
  }

  // Security check: Operation count
  const operationCount = tokens.filter(t => t.type === 'operator' || t.type === 'function').length
  if (operationCount > MAX_OPERATIONS) {
    return {
      success: false,
      error: `Formula too complex (max ${MAX_OPERATIONS} operations)`
    }
  }

  return { success: true, tokens }
}

// ============================================================================
// Expression Evaluation
// ============================================================================

/**
 * Evaluate tokenized formula with given context
 * Uses Shunting Yard algorithm for operator precedence
 */
export function evaluateFormula(
  tokens: FormulaToken[],
  context: FormulaContext,
  availableColumns: string[]
): FormulaEvaluationResult {
  const usedColumns: Set<string> = new Set()

  // Convert tokens to Reverse Polish Notation (RPN) using Shunting Yard
  const outputQueue: FormulaToken[] = []
  const operatorStack: FormulaToken[] = []

  const precedence: Record<string, number> = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
    '%': 2
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'number' || token.type === 'column') {
      outputQueue.push(token)
    } else if (token.type === 'function') {
      operatorStack.push(token)
    } else if (token.type === 'operator') {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1].type !== 'paren' &&
        (operatorStack[operatorStack.length - 1].type === 'function' ||
          (precedence[operatorStack[operatorStack.length - 1].value] || 0) >= precedence[token.value])
      ) {
        outputQueue.push(operatorStack.pop()!)
      }
      operatorStack.push(token)
    } else if (token.type === 'paren') {
      if (token.value === '(') {
        operatorStack.push(token)
      } else {
        // Pop until matching '('
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].value !== '(') {
          outputQueue.push(operatorStack.pop()!)
        }

        if (operatorStack.length === 0) {
          return { success: false, error: 'Mismatched parentheses' }
        }

        operatorStack.pop() // Remove '('

        // If there's a function on top, add it to output
        if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type === 'function') {
          outputQueue.push(operatorStack.pop()!)
        }
      }
    }
  }

  // Pop remaining operators
  while (operatorStack.length > 0) {
    const op = operatorStack.pop()!
    if (op.type === 'paren') {
      return { success: false, error: 'Mismatched parentheses' }
    }
    outputQueue.push(op)
  }

  // Evaluate RPN expression
  const valueStack: number[] = []

  for (const token of outputQueue) {
    if (token.type === 'number') {
      valueStack.push(parseFloat(token.value))
    } else if (token.type === 'column') {
      // Resolve column value
      const columnName = findMatchingColumn(token.value, availableColumns)

      if (!columnName) {
        return {
          success: false,
          error: `Column not found: "${token.value}". Available: ${availableColumns.join(', ')}`
        }
      }

      usedColumns.add(columnName)

      // Get value from context
      let value: number | null = null

      if (context.aggregatedData && context.aggregatedData.has(columnName)) {
        value = context.aggregatedData.get(columnName)!
      } else if (context.row) {
        value = parseNumericValue(context.row[columnName])
      }

      if (value === null) {
        return {
          success: false,
          error: `Cannot read numeric value from column: "${columnName}"`
        }
      }

      valueStack.push(value)
    } else if (token.type === 'operator') {
      if (valueStack.length < 2) {
        return { success: false, error: 'Invalid expression (not enough operands)' }
      }

      const b = valueStack.pop()!
      const a = valueStack.pop()!

      let result: number

      switch (token.value) {
        case '+':
          result = a + b
          break
        case '-':
          result = a - b
          break
        case '*':
          result = a * b
          break
        case '/':
          if (b === 0) {
            return { success: false, error: 'Division by zero' }
          }
          result = a / b
          break
        case '%':
          if (b === 0) {
            return { success: false, error: 'Modulo by zero' }
          }
          result = a % b
          break
        default:
          return { success: false, error: `Unknown operator: ${token.value}` }
      }

      // Safety check: Result overflow
      if (!isFinite(result)) {
        return { success: false, error: 'Calculation resulted in invalid number (overflow/underflow)' }
      }

      valueStack.push(result)
    } else if (token.type === 'function') {
      // Functions require access to all data
      if (!context.allData) {
        return { success: false, error: `Function ${token.value} requires full dataset` }
      }

      if (valueStack.length < 1) {
        return { success: false, error: `Function ${token.value} requires an argument` }
      }

      // For functions, the argument should be a column reference
      // We need to get the column name from the previous token
      // Actually, in RPN, the column value is already on the stack
      // But for aggregation functions, we need the raw column name

      // This is a limitation of our current approach
      // We'll handle it by requiring aggregate functions to be evaluated separately
      // For now, functions operate on the value on the stack

      const arg = valueStack.pop()!
      let result: number

      switch (token.value) {
        case 'ABS':
          result = Math.abs(arg)
          break
        case 'ROUND':
          result = Math.round(arg)
          break
        case 'SQRT':
          if (arg < 0) {
            return { success: false, error: 'Cannot take square root of negative number' }
          }
          result = Math.sqrt(arg)
          break
        case 'SUM':
        case 'AVG':
        case 'COUNT':
        case 'MIN':
        case 'MAX':
          // These should be pre-calculated in aggregatedData
          return {
            success: false,
            error: `Aggregate function ${token.value} must be pre-calculated`
          }
        default:
          return { success: false, error: `Unknown function: ${token.value}` }
      }

      if (!isFinite(result)) {
        return { success: false, error: `Function ${token.value} resulted in invalid number` }
      }

      valueStack.push(result)
    }
  }

  if (valueStack.length !== 1) {
    return { success: false, error: 'Invalid expression (unbalanced operations)' }
  }

  return {
    success: true,
    value: valueStack[0],
    usedColumns: Array.from(usedColumns)
  }
}

// ============================================================================
// Aggregate Function Handling
// ============================================================================

/**
 * Extract aggregate functions from formula
 * Returns list of aggregations needed before formula evaluation
 */
export function extractAggregateFunctions(tokens: FormulaToken[]): Array<{
  function: string
  column: string
  alias: string
}> {
  const aggregations: Array<{ function: string; column: string; alias: string }> = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token.type === 'function' && ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(token.value)) {
      // Find the column argument (should be next non-paren token)
      let columnToken: FormulaToken | null = null

      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'column') {
          columnToken = tokens[j]
          break
        }
        if (tokens[j].type === 'paren' && tokens[j].value === ')') {
          break
        }
      }

      if (columnToken) {
        const alias = `${token.value}_${columnToken.value}`
        aggregations.push({
          function: token.value,
          column: columnToken.value,
          alias
        })
      }
    }
  }

  return aggregations
}

/**
 * Replace aggregate function calls with their pre-calculated values
 */
export function replaceAggregateFunctions(
  tokens: FormulaToken[],
  aggregatedValues: Map<string, number>
): FormulaToken[] {
  const result: FormulaToken[] = []

  let i = 0
  while (i < tokens.length) {
    const token = tokens[i]

    if (token.type === 'function' && ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(token.value)) {
      // Find the column argument
      let columnToken: FormulaToken | null = null
      let endParen = -1

      for (let j = i + 1; j < tokens.length; j++) {
        if (tokens[j].type === 'column' && !columnToken) {
          columnToken = tokens[j]
        }
        if (tokens[j].type === 'paren' && tokens[j].value === ')') {
          endParen = j
          break
        }
      }

      if (columnToken) {
        const alias = `${token.value}_${columnToken.value}`
        const value = aggregatedValues.get(alias)

        if (value !== undefined) {
          // Replace function call with the aggregated value
          result.push({ type: 'number', value: value.toString(), position: token.position })

          // Skip to after the closing paren
          i = endParen + 1
          continue
        }
      }
    }

    result.push(token)
    i++
  }

  return result
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse and validate formula
 */
export function parseFormula(formula: string): FormulaParseResult {
  return tokenizeFormula(formula)
}

/**
 * Validate formula against available columns
 */
export function validateFormula(
  formula: string,
  availableColumns: string[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Parse formula
  const parseResult = tokenizeFormula(formula)
  if (!parseResult.success) {
    errors.push(parseResult.error || 'Failed to parse formula')
    return { valid: false, errors }
  }

  // Check all column references exist
  const tokens = parseResult.tokens!
  for (const token of tokens) {
    if (token.type === 'column') {
      const matchingColumn = findMatchingColumn(token.value, availableColumns)
      if (!matchingColumn) {
        errors.push(`Column not found: "${token.value}". Available columns: ${availableColumns.join(', ')}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Calculate formula for a single row
 */
export function calculateFormulaForRow(
  formula: string,
  row: DataRow,
  availableColumns: string[],
  aggregatedData?: Map<string, number>
): FormulaEvaluationResult {
  // Parse formula
  const parseResult = tokenizeFormula(formula)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error
    }
  }

  let tokens = parseResult.tokens!

  // If we have aggregated data, replace function calls
  if (aggregatedData) {
    tokens = replaceAggregateFunctions(tokens, aggregatedData)
  }

  // Evaluate
  return evaluateFormula(tokens, { row, aggregatedData }, availableColumns)
}
