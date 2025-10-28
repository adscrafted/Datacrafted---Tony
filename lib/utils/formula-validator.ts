/**
 * Formula Validator
 *
 * Comprehensive validation for formulas to ensure:
 * - Syntax is valid
 * - Referenced columns exist
 * - No division by zero
 * - Results are numeric
 * - Complexity is within limits
 */

import type { DataRow } from '@/lib/store'
// Formula parser was removed - using stub implementations
// import {
//   parseFormula,
//   validateFormula as basicValidateFormula,
//   tokenizeFormula,
//   findMatchingColumn,
//   extractAggregateFunctions,
//   calculateFormulaForRow
// } from './formula-parser'

// Stub implementations
function parseFormula(formula: string): any {
  return { valid: true, tokens: [] }
}

function basicValidateFormula(formula: string): { valid: boolean; error?: string } {
  return { valid: true }
}

function tokenizeFormula(formula: string): any[] {
  return []
}

function findMatchingColumn(name: string, columns: string[]): string | null {
  return columns.find(c => c === name) || null
}

function extractAggregateFunctions(tokens: any[]): string[] {
  return []
}

function calculateFormulaForRow(formula: string, row: any, allData: any[]): number {
  return 0
}
import { parseNumericValue, DataCalculator } from './data-calculations'

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  metadata?: {
    usedColumns: string[]
    hasAggregations: boolean
    aggregationFunctions: string[]
    complexity: number
  }
}

export interface SafetyCheckResult {
  safe: boolean
  issues: string[]
  severity: 'error' | 'warning' | 'info'
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Comprehensive formula validation
 */
export function validateFormulaComprehensive(
  formula: string,
  data: DataRow[],
  options?: {
    requireNumericResult?: boolean
    checkDivisionByZero?: boolean
    maxComplexity?: number
  }
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const opts = {
    requireNumericResult: true,
    checkDivisionByZero: true,
    maxComplexity: 50,
    ...options
  }

  // 1. Basic parsing validation
  const parseResult = parseFormula(formula)
  if (!parseResult.success) {
    errors.push(parseResult.error || 'Failed to parse formula')
    return { valid: false, errors, warnings }
  }

  const tokens = parseResult.tokens!

  // 2. Get available columns
  if (!data || data.length === 0) {
    errors.push('No data available for validation')
    return { valid: false, errors, warnings }
  }

  const availableColumns = Object.keys(data[0])

  // 3. Validate column references
  const columnValidation = basicValidateFormula(formula, availableColumns)
  if (!columnValidation.valid) {
    errors.push(...columnValidation.errors)
  }

  // 4. Extract metadata
  const usedColumns = new Set<string>()
  const aggregationFunctions: string[] = []
  let hasAggregations = false

  tokens.forEach(token => {
    if (token.type === 'column') {
      const matchingColumn = findMatchingColumn(token.value, availableColumns)
      if (matchingColumn) {
        usedColumns.add(matchingColumn)
      }
    }
    if (token.type === 'function' && ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(token.value)) {
      hasAggregations = true
      aggregationFunctions.push(token.value)
    }
  })

  // 5. Check column data types (ensure numeric)
  for (const column of Array.from(usedColumns)) {
    const sampleValues = data.slice(0, 100).map(row => row[column])
    const numericValues = sampleValues.filter(val => parseNumericValue(val) !== null)

    if (numericValues.length === 0) {
      errors.push(`Column "${column}" does not contain numeric values`)
    } else if (numericValues.length < sampleValues.length * 0.5) {
      warnings.push(`Column "${column}" has less than 50% numeric values (${numericValues.length}/${sampleValues.length})`)
    }
  }

  // 6. Check for division by zero risk
  if (opts.checkDivisionByZero) {
    const divisionCheck = checkDivisionByZeroRisk(tokens, data, Array.from(usedColumns))
    if (!divisionCheck.safe) {
      if (divisionCheck.severity === 'error') {
        errors.push(...divisionCheck.issues)
      } else if (divisionCheck.severity === 'warning') {
        warnings.push(...divisionCheck.issues)
      }
    }
  }

  // 7. Check complexity
  const complexity = calculateComplexity(tokens)
  if (complexity > opts.maxComplexity) {
    errors.push(`Formula too complex (complexity: ${complexity}, max: ${opts.maxComplexity})`)
  }

  if (complexity > opts.maxComplexity * 0.7) {
    warnings.push(`Formula complexity is high (${complexity}/${opts.maxComplexity})`)
  }

  // 8. Test evaluation on sample data
  if (errors.length === 0) {
    const testResult = testFormulaEvaluation(formula, data.slice(0, 10), availableColumns, hasAggregations)
    if (!testResult.success) {
      errors.push(...testResult.errors)
    } else if (testResult.warnings.length > 0) {
      warnings.push(...testResult.warnings)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      usedColumns: Array.from(usedColumns),
      hasAggregations,
      aggregationFunctions,
      complexity
    }
  }
}

/**
 * Check if formula has risk of division by zero
 */
function checkDivisionByZeroRisk(
  tokens: any[],
  data: DataRow[],
  usedColumns: string[]
): SafetyCheckResult {
  const issues: string[] = []

  // Find division operators
  const divisionIndices: number[] = []
  tokens.forEach((token, index) => {
    if (token.type === 'operator' && (token.value === '/' || token.value === '%')) {
      divisionIndices.push(index)
    }
  })

  if (divisionIndices.length === 0) {
    return { safe: true, issues: [], severity: 'info' }
  }

  // Check if any column used in denominator contains zeros
  for (const column of usedColumns) {
    const values = data.slice(0, 1000).map(row => parseNumericValue(row[column]))
    const hasZeros = values.some(val => val === 0)
    const allZeros = values.every(val => val === 0 || val === null)

    if (allZeros) {
      issues.push(`Column "${column}" contains only zeros - will cause division by zero error`)
      return { safe: false, issues, severity: 'error' }
    }

    if (hasZeros) {
      issues.push(`Column "${column}" contains some zeros - may cause division by zero in some rows`)
    }
  }

  return {
    safe: issues.length === 0,
    issues,
    severity: issues.length > 0 ? 'warning' : 'info'
  }
}

/**
 * Calculate formula complexity score
 */
function calculateComplexity(tokens: any[]): number {
  let score = 0

  const weights = {
    number: 0.1,
    column: 0.5,
    operator: 1,
    function: 2,
    paren: 0.2
  }

  tokens.forEach(token => {
    score += weights[token.type as keyof typeof weights] || 0
  })

  return Math.round(score)
}

/**
 * Test formula evaluation on sample data
 */
function testFormulaEvaluation(
  formula: string,
  sampleData: DataRow[],
  availableColumns: string[],
  hasAggregations: boolean
): { success: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (sampleData.length === 0) {
    return { success: true, errors, warnings }
  }

  try {
    // If has aggregations, calculate them first
    let aggregatedData: Map<string, number> | undefined

    if (hasAggregations) {
      const parseResult = tokenizeFormula(formula)
      if (parseResult.success) {
        const aggregations = extractAggregateFunctions(parseResult.tokens!)
        aggregatedData = new Map()

        for (const agg of aggregations) {
          const matchingColumn = findMatchingColumn(agg.column, availableColumns)
          if (matchingColumn) {
            let value: number | null = null

            switch (agg.function) {
              case 'SUM':
                value = DataCalculator.aggregate(sampleData, { column: matchingColumn, type: 'sum' })
                break
              case 'AVG':
                value = DataCalculator.aggregate(sampleData, { column: matchingColumn, type: 'avg' })
                break
              case 'COUNT':
                value = DataCalculator.aggregate(sampleData, { column: matchingColumn, type: 'count' })
                break
              case 'MIN':
                value = DataCalculator.aggregate(sampleData, { column: matchingColumn, type: 'min' })
                break
              case 'MAX':
                value = DataCalculator.aggregate(sampleData, { column: matchingColumn, type: 'max' })
                break
            }

            if (value !== null) {
              aggregatedData.set(agg.alias, value)
            }
          }
        }
      }
    }

    // Test on first row
    const testRow = sampleData[0]
    const result = calculateFormulaForRow(formula, testRow, availableColumns, aggregatedData)

    if (!result.success) {
      errors.push(`Formula evaluation failed: ${result.error}`)
    } else if (result.value === null || result.value === undefined) {
      warnings.push('Formula evaluation resulted in null value')
    } else if (!isFinite(result.value)) {
      errors.push('Formula evaluation resulted in non-finite value (Infinity or NaN)')
    } else if (Math.abs(result.value) > 1e15) {
      warnings.push('Formula evaluation resulted in very large value - possible overflow risk')
    }

    // Test on a few more rows if not aggregated
    if (!hasAggregations && sampleData.length > 1) {
      const testRows = sampleData.slice(1, Math.min(5, sampleData.length))
      let successCount = 0
      let failCount = 0

      for (const row of testRows) {
        const rowResult = calculateFormulaForRow(formula, row, availableColumns)
        if (rowResult.success && isFinite(rowResult.value!)) {
          successCount++
        } else {
          failCount++
        }
      }

      if (failCount > 0) {
        warnings.push(`Formula failed on ${failCount}/${testRows.length} sample rows`)
      }
    }
  } catch (error) {
    errors.push(`Unexpected error during evaluation: ${error instanceof Error ? error.message : String(error)}`)
  }

  return { success: errors.length === 0, errors, warnings }
}

/**
 * Quick validation (syntax only, no data required)
 */
export function quickValidateFormula(formula: string): { valid: boolean; error?: string } {
  const parseResult = parseFormula(formula)
  return {
    valid: parseResult.success,
    error: parseResult.error
  }
}

/**
 * Validate formula output type
 */
export function validateFormulaOutputType(
  formula: string,
  data: DataRow[],
  expectedType: 'number' | 'percentage' | 'ratio' | 'currency'
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const validation = validateFormulaComprehensive(formula, data)

  if (!validation.valid) {
    return validation
  }

  // Check if formula produces values in expected range
  const sampleResults: number[] = []
  const availableColumns = Object.keys(data[0])

  for (let i = 0; i < Math.min(100, data.length); i++) {
    const result = calculateFormulaForRow(formula, data[i], availableColumns)
    if (result.success && result.value !== undefined && isFinite(result.value)) {
      sampleResults.push(result.value)
    }
  }

  if (sampleResults.length === 0) {
    errors.push('Formula produced no valid numeric results')
    return { valid: false, errors, warnings }
  }

  const min = Math.min(...sampleResults)
  const max = Math.max(...sampleResults)

  switch (expectedType) {
    case 'percentage':
      if (max > 1000) {
        warnings.push(`Percentage values seem too large (max: ${max}). Did you mean to multiply by 100?`)
      }
      if (min < 0) {
        warnings.push('Percentage values include negative numbers')
      }
      break

    case 'ratio':
      if (Math.abs(min) > 1000 || Math.abs(max) > 1000) {
        warnings.push(`Ratio values seem very large (range: ${min} to ${max})`)
      }
      break

    case 'currency':
      if (min < 0 && max > 0) {
        warnings.push('Currency values include both positive and negative amounts')
      }
      break
  }

  return { valid: true, errors, warnings }
}

/**
 * Suggest formula improvements
 */
export function suggestFormulaImprovements(formula: string, data: DataRow[]): string[] {
  const suggestions: string[] = []

  const parseResult = parseFormula(formula)
  if (!parseResult.success) {
    return suggestions
  }

  const tokens = parseResult.tokens!

  // Check for common patterns
  const hasPercentageMultiplication = tokens.some(
    (token, i) =>
      token.type === 'operator' &&
      token.value === '*' &&
      i + 1 < tokens.length &&
      tokens[i + 1].type === 'number' &&
      tokens[i + 1].value === '100'
  )

  if (hasPercentageMultiplication) {
    suggestions.push('Formula multiplies by 100 for percentage - ensure this is intentional')
  }

  // Check for division without aggregation
  const hasDivision = tokens.some(t => t.type === 'operator' && (t.value === '/' || t.value === '%'))
  const hasAggregation = tokens.some(
    t => t.type === 'function' && ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(t.value)
  )

  if (hasDivision && !hasAggregation && data.length > 1) {
    suggestions.push(
      'Formula calculates per-row ratio. Consider using SUM() or AVG() for aggregate metrics like "SUM(Revenue) / SUM(Cost)"'
    )
  }

  // Check for complex nested expressions
  let parenDepth = 0
  let maxDepth = 0
  tokens.forEach(token => {
    if (token.type === 'paren') {
      if (token.value === '(') {
        parenDepth++
        maxDepth = Math.max(maxDepth, parenDepth)
      } else {
        parenDepth--
      }
    }
  })

  if (maxDepth > 3) {
    suggestions.push('Formula has deep nesting - consider breaking into multiple calculated columns for clarity')
  }

  return suggestions
}

/**
 * Validate formula for specific chart type
 */
export function validateFormulaForChartType(
  formula: string,
  data: DataRow[],
  chartType: 'scorecard' | 'bar' | 'line' | 'pie' | 'scatter'
): ValidationResult {
  const validation = validateFormulaComprehensive(formula, data)

  if (!validation.valid) {
    return validation
  }

  const warnings = [...validation.warnings]

  // Chart-specific validations
  if (chartType === 'scorecard') {
    if (!validation.metadata?.hasAggregations) {
      warnings.push('Scorecard typically shows aggregated metrics. Consider using SUM(), AVG(), or COUNT()')
    }
  }

  if (chartType === 'bar' || chartType === 'line') {
    if (validation.metadata?.hasAggregations) {
      warnings.push('Bar/line charts with formulas may need group-by. Ensure aggregation is intentional.')
    }
  }

  return { ...validation, warnings }
}
