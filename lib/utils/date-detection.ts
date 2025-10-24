/**
 * Shared utilities for detecting date columns and parsing date values
 *
 * This module consolidates all date detection logic in one place
 * to avoid duplication and ensure consistency across the application.
 */

import type { DataRow } from '@/lib/store'

/**
 * Check if a value is a valid date
 *
 * @param value - The value to check
 * @returns true if the value is a valid date between 1900-2100
 */
export function isValidDate(value: any): boolean {
  if (value === null || value === undefined) return false

  // Skip non-string values except Date objects
  if (typeof value !== 'string' && !(value instanceof Date)) return false

  // Try to parse the date
  const parsed = Date.parse(String(value))
  if (isNaN(parsed)) return false

  // Check if the date is in a reasonable range (1900-2100)
  const date = new Date(parsed)
  const year = date.getFullYear()

  return year >= 1900 && year <= 2100
}

/**
 * Check if a column contains date values
 *
 * @param data - The data rows to check
 * @param column - The column name to check
 * @param sampleSize - Number of rows to sample (default: 10)
 * @returns true if the column appears to contain dates
 */
export function isDateColumn(
  data: DataRow[],
  column: string,
  sampleSize: number = 10
): boolean {
  if (!data || data.length === 0) return false

  // Sample the first N non-null values
  const samples = data
    .slice(0, Math.min(data.length, sampleSize * 2)) // Check more rows to find enough non-null values
    .map(row => row[column])
    .filter(value => value !== null && value !== undefined)
    .slice(0, sampleSize)

  if (samples.length === 0) return false

  // Count how many samples are valid dates
  const validDateCount = samples.filter(isValidDate).length

  // Consider it a date column if at least 80% of samples are valid dates
  return validDateCount >= samples.length * 0.8
}

/**
 * Detect all date columns in a dataset
 *
 * @param data - The data rows to analyze
 * @param sampleSize - Number of rows to sample per column (default: 10)
 * @returns Array of column names that appear to contain dates
 */
export function detectDateColumns(
  data: DataRow[],
  sampleSize: number = 10
): string[] {
  if (!data || data.length === 0) return []

  const dateColumns: string[] = []
  const columns = Object.keys(data[0])

  for (const column of columns) {
    if (isDateColumn(data, column, sampleSize)) {
      dateColumns.push(column)
    }
  }

  return dateColumns
}

/**
 * Parse a date value to a Date object
 *
 * @param value - The value to parse
 * @returns Date object or null if parsing fails
 */
export function parseDate(value: any): Date | null {
  if (!isValidDate(value)) return null

  try {
    return new Date(value)
  } catch {
    return null
  }
}

/**
 * Check if a column name suggests it might contain dates
 *
 * @param columnName - The column name to check
 * @returns true if the column name contains date-related keywords
 */
export function columnNameSuggestsDate(columnName: string): boolean {
  const dateKeywords = [
    'date', 'time', 'datetime', 'timestamp', 'created', 'updated',
    'modified', 'year', 'month', 'day', 'hour', 'minute', 'second',
    'start', 'end', 'begin', 'finish', 'period', 'quarter',
    'week', 'dob', 'birthday', 'anniversary', 'expiry', 'due'
  ]

  const normalizedName = columnName.toLowerCase()
  return dateKeywords.some(keyword => normalizedName.includes(keyword))
}

/**
 * Get the best date column from a dataset
 * Prioritizes columns with date-related names, then falls back to content analysis
 *
 * @param data - The data rows to analyze
 * @returns The most likely date column name, or null if none found
 */
export function getBestDateColumn(data: DataRow[]): string | null {
  if (!data || data.length === 0) return null

  const columns = Object.keys(data[0])

  // First, check for columns with date-related names
  const namedDateColumns = columns.filter(col =>
    columnNameSuggestsDate(col) && isDateColumn(data, col)
  )

  if (namedDateColumns.length > 0) {
    // Prioritize columns with 'date' in the name
    const primaryDateCol = namedDateColumns.find(col =>
      col.toLowerCase().includes('date')
    )
    return primaryDateCol || namedDateColumns[0]
  }

  // Fall back to content analysis
  const allDateColumns = detectDateColumns(data)
  return allDateColumns.length > 0 ? allDateColumns[0] : null
}