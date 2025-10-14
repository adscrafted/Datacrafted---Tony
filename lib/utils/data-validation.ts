/**
 * Data Validation Utilities
 *
 * Provides utilities for validating, analyzing, and calculating metrics
 * for tabular data before storage.
 *
 * Features:
 * - Data structure validation
 * - Column type inference
 * - Data quality metrics calculation
 * - Schema validation
 * - Null/duplicate detection
 */

export interface DataRow {
  [key: string]: unknown
}

/**
 * Column type inference result
 */
export interface ColumnType {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'null' | 'mixed'
  nullable: boolean
  uniqueCount?: number
  sampleValues?: unknown[]
}

/**
 * Data quality metrics
 */
export interface DataQualityMetrics {
  rowCount: number
  columnCount: number
  columnNames: string[]
  columnTypes: Record<string, string>
  nullCount: number
  duplicateRowCount: number
  dataQualityScore: number
  completeness: number
  uniqueness: number
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  metrics?: DataQualityMetrics
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly errors: string[] = [],
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate that data is an array of objects
 *
 * @param data - Data to validate
 * @returns True if valid
 */
export function isValidDataStructure(data: unknown): data is DataRow[] {
  if (!Array.isArray(data)) {
    return false
  }

  if (data.length === 0) {
    return true // Empty array is valid
  }

  // Check first row is an object
  return typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])
}

/**
 * Infer column types from data
 *
 * @param data - Array of data rows
 * @returns Array of column type information
 */
export function inferColumnTypes(data: DataRow[]): ColumnType[] {
  if (data.length === 0) {
    return []
  }

  const columns = Object.keys(data[0])
  const columnTypes: ColumnType[] = []

  for (const columnName of columns) {
    const values = data.map(row => row[columnName])
    const nonNullValues = values.filter(v => v !== null && v !== undefined)

    // Determine type by sampling values
    let type: ColumnType['type'] = 'null'

    if (nonNullValues.length > 0) {
      const types = new Set<string>()

      for (const value of nonNullValues) {
        if (typeof value === 'string') {
          // Check if it's a date string
          if (isDateString(value)) {
            types.add('date')
          } else {
            types.add('string')
          }
        } else if (typeof value === 'number') {
          types.add('number')
        } else if (typeof value === 'boolean') {
          types.add('boolean')
        } else {
          types.add('string') // Default to string for unknown types
        }
      }

      if (types.size === 1) {
        type = Array.from(types)[0] as ColumnType['type']
      } else {
        type = 'mixed'
      }
    }

    columnTypes.push({
      name: columnName,
      type,
      nullable: nonNullValues.length < values.length,
      uniqueCount: new Set(nonNullValues).size,
      sampleValues: nonNullValues.slice(0, 5)
    })
  }

  return columnTypes
}

/**
 * Check if a string value is a date
 */
function isDateString(value: string): boolean {
  if (typeof value !== 'string') return false

  // Try parsing as date
  const date = new Date(value)
  return !isNaN(date.getTime()) && value.length > 8 // Minimum date string length
}

/**
 * Calculate data quality metrics
 *
 * @param data - Array of data rows
 * @returns Data quality metrics
 */
export function calculateDataQualityMetrics(data: DataRow[]): DataQualityMetrics {
  if (data.length === 0) {
    return {
      rowCount: 0,
      columnCount: 0,
      columnNames: [],
      columnTypes: {},
      nullCount: 0,
      duplicateRowCount: 0,
      dataQualityScore: 100,
      completeness: 100,
      uniqueness: 100
    }
  }

  const rowCount = data.length
  const columnNames = Object.keys(data[0])
  const columnCount = columnNames.length

  // Infer column types
  const columnTypeInfo = inferColumnTypes(data)
  const columnTypes: Record<string, string> = {}
  columnTypeInfo.forEach(col => {
    columnTypes[col.name] = col.type
  })

  // Count nulls
  let nullCount = 0
  for (const row of data) {
    for (const key of columnNames) {
      if (row[key] === null || row[key] === undefined || row[key] === '') {
        nullCount++
      }
    }
  }

  // Count duplicates (based on JSON string comparison)
  const rowStrings = new Set<string>()
  let duplicateRowCount = 0
  for (const row of data) {
    const rowString = JSON.stringify(row)
    if (rowStrings.has(rowString)) {
      duplicateRowCount++
    } else {
      rowStrings.add(rowString)
    }
  }

  // Calculate metrics
  const totalCells = rowCount * columnCount
  const completeness = totalCells > 0 ? ((totalCells - nullCount) / totalCells) * 100 : 100
  const uniqueness = rowCount > 0 ? ((rowCount - duplicateRowCount) / rowCount) * 100 : 100

  // Overall quality score (weighted average)
  const dataQualityScore = (completeness * 0.7 + uniqueness * 0.3)

  return {
    rowCount,
    columnCount,
    columnNames,
    columnTypes,
    nullCount,
    duplicateRowCount,
    dataQualityScore,
    completeness,
    uniqueness
  }
}

/**
 * Validate data before storage
 *
 * @param data - Data to validate
 * @param maxRows - Maximum allowed rows (default 1M)
 * @param maxColumns - Maximum allowed columns (default 1000)
 * @returns Validation result
 */
export function validateData(
  data: unknown,
  maxRows: number = 1_000_000,
  maxColumns: number = 1000
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Check if data is valid structure
  if (!isValidDataStructure(data)) {
    errors.push('Data must be an array of objects')
    return { valid: false, errors, warnings }
  }

  // Check for empty data
  if (data.length === 0) {
    warnings.push('Data is empty')
    return {
      valid: true,
      errors,
      warnings,
      metrics: {
        rowCount: 0,
        columnCount: 0,
        columnNames: [],
        columnTypes: {},
        nullCount: 0,
        duplicateRowCount: 0,
        dataQualityScore: 100,
        completeness: 100,
        uniqueness: 100
      }
    }
  }

  // Check row count limit
  if (data.length > maxRows) {
    errors.push(`Data exceeds maximum row count: ${data.length} > ${maxRows}`)
  }

  // Check column count limit
  const columnCount = Object.keys(data[0]).length
  if (columnCount > maxColumns) {
    errors.push(`Data exceeds maximum column count: ${columnCount} > ${maxColumns}`)
  }

  if (columnCount === 0) {
    errors.push('Data rows must have at least one column')
  }

  // Check all rows have consistent structure
  const expectedKeys = Object.keys(data[0]).sort()
  for (let i = 1; i < Math.min(data.length, 100); i++) { // Check first 100 rows
    const rowKeys = Object.keys(data[i]).sort()
    if (JSON.stringify(rowKeys) !== JSON.stringify(expectedKeys)) {
      warnings.push(`Row ${i} has inconsistent column structure`)
      break
    }
  }

  // If validation passed, calculate metrics
  let metrics: DataQualityMetrics | undefined
  if (errors.length === 0) {
    try {
      metrics = calculateDataQualityMetrics(data)

      // Add warnings based on metrics
      if (metrics.dataQualityScore < 50) {
        warnings.push(`Low data quality score: ${metrics.dataQualityScore.toFixed(1)}%`)
      }
      if (metrics.completeness < 80) {
        warnings.push(`High percentage of null values: ${(100 - metrics.completeness).toFixed(1)}%`)
      }
      if (metrics.duplicateRowCount > data.length * 0.1) {
        warnings.push(`High number of duplicate rows: ${metrics.duplicateRowCount} (${((metrics.duplicateRowCount / data.length) * 100).toFixed(1)}%)`)
      }
    } catch (error) {
      warnings.push(`Failed to calculate data quality metrics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metrics
  }
}

/**
 * Create sample data (first N rows) for preview
 *
 * @param data - Full dataset
 * @param sampleSize - Number of rows to sample (default 100)
 * @returns Sample data
 */
export function createSampleData(data: DataRow[], sampleSize: number = 100): DataRow[] {
  return data.slice(0, sampleSize)
}

/**
 * Calculate hash of data for deduplication
 *
 * @param data - Data to hash
 * @returns Hash string
 */
export function calculateDataHash(data: DataRow[]): string {
  // Simple hash based on JSON string
  // In production, consider using a proper hashing algorithm
  const jsonString = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}
