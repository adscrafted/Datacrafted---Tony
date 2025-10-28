/**
 * Schema Analysis Service
 * Handles data schema detection, type inference, and validation
 */

import type { DataRow, DataSchema, ColumnSchema } from '@/lib/store'
import { detectDateWithConfidence, analyzeDataSchema } from '@/lib/utils/schema-analyzer'

const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') console.log(...args)
  },
  info: console.log,
  warn: console.warn,
  error: console.error
}

export interface SchemaAnalysisResult {
  schema: DataSchema
  dataContext: DataContext
  businessDomain: BusinessDomain
}

export interface DataContext {
  rowCount: number
  columnCount: number
  columns: string[]
  sampleSize: number
  numericalColumns: string[]
  categoricalColumns: string[]
  temporalColumns: string[]
  hasTimeSeries: boolean
  hasCategories: boolean
  hasMultipleMetrics: boolean
  patternSummary: string
}

export type BusinessDomain = 'advertising' | 'ecommerce' | 'sales' | 'operations' | 'general'

export class SchemaService {
  /**
   * Analyze data structure and infer schema
   */
  analyzeDataStructure(data: DataRow[]): SchemaAnalysisResult {
    const startTime = Date.now()

    // Get column names
    const columns = Object.keys(data[0] || {})
    const rowCount = data.length
    const columnCount = columns.length

    // Analyze schema using existing utility
    const schema = analyzeDataSchema(data)

    // Extract column types
    const numericalColumns: string[] = []
    const categoricalColumns: string[] = []
    const temporalColumns: string[] = []

    schema.columns.forEach(col => {
      if (col.type === 'number') {
        numericalColumns.push(col.name)
      } else if (col.type === 'date') {
        temporalColumns.push(col.name)
      } else {
        categoricalColumns.push(col.name)
      }
    })

    // Detect business domain
    const businessDomain = this.detectBusinessDomain(columns)

    // Create data context
    const dataContext: DataContext = {
      rowCount,
      columnCount,
      columns,
      sampleSize: Math.min(data.length, 25),
      numericalColumns,
      categoricalColumns,
      temporalColumns,
      hasTimeSeries: temporalColumns.length > 0,
      hasCategories: categoricalColumns.length > 0,
      hasMultipleMetrics: numericalColumns.length > 1,
      patternSummary: this.generatePatternSummary(schema)
    }

    logger.debug('[SchemaService] Analysis completed in', Date.now() - startTime, 'ms')

    return {
      schema,
      dataContext,
      businessDomain
    }
  }

  /**
   * Detect business domain based on column names
   */
  private detectBusinessDomain(columns: string[]): BusinessDomain {
    const columnNames = columns.map(c => c.toLowerCase())

    const domains = {
      advertising: ['impressions', 'clicks', 'ctr', 'cpm', 'cpc', 'campaign', 'ad_spend', 'conversions', 'roas'],
      ecommerce: ['product', 'price', 'quantity', 'cart', 'checkout', 'order', 'customer', 'revenue', 'sku'],
      sales: ['pipeline', 'lead', 'opportunity', 'deal', 'quota', 'revenue', 'customer', 'prospect', 'close_date'],
      operations: ['inventory', 'supply', 'demand', 'capacity', 'utilization', 'throughput', 'cycle_time', 'efficiency']
    }

    let maxMatches = 0
    let detectedDomain: BusinessDomain = 'general'

    for (const [domain, keywords] of Object.entries(domains)) {
      const matches = keywords.filter(keyword =>
        columnNames.some(col => col.includes(keyword))
      ).length

      if (matches > maxMatches) {
        maxMatches = matches
        detectedDomain = domain as BusinessDomain
      }
    }

    logger.debug('[SchemaService] Detected business domain:', detectedDomain)
    return detectedDomain
  }

  /**
   * Generate a summary of data patterns
   */
  private generatePatternSummary(schema: DataSchema): string {
    const patterns: string[] = []

    // Count column types
    const typeCounts = schema.columns.reduce((acc, col) => {
      acc[col.type] = (acc[col.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Build pattern summary
    if (typeCounts.number > 0) {
      patterns.push(`${typeCounts.number} numeric column(s)`)
    }
    if (typeCounts.date > 0) {
      patterns.push(`${typeCounts.date} date column(s)`)
    }
    if (typeCounts.string > 0) {
      patterns.push(`${typeCounts.string} text column(s)`)
    }
    if (typeCounts.boolean > 0) {
      patterns.push(`${typeCounts.boolean} boolean column(s)`)
    }

    return patterns.join(', ')
  }

  /**
   * Apply user corrections to schema
   */
  applyUserCorrections(
    schema: DataSchema,
    corrections: Array<{ name: string; type: string; description?: string }>
  ): DataSchema {
    const correctedColumns = schema.columns.map(col => {
      const correction = corrections.find(c => c.name === col.name)
      if (correction) {
        return {
          ...col,
          type: correction.type as any,
          description: correction.description || col.description,
          userCorrected: true,
          confidence: 100
        }
      }
      return col
    })

    return {
      ...schema,
      columns: correctedColumns
    }
  }
}

// Export singleton instance
export const schemaService = new SchemaService()