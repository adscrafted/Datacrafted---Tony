/**
 * Chart suggestion engine that processes AI suggestions and creates visualizations
 */

import { ChartSuggestion, FilterCondition, OrderByCondition, AggregationCondition, ColumnTransform } from '@/lib/types/chart-suggestion'
import { DataRow } from '@/lib/store'
import { logger } from '@/lib/utils/logger'

export class ChartSuggestionEngine {
  
  /**
   * Parse AI response and extract chart suggestions
   */
  parseAISuggestions(aiResponse: string): ChartSuggestion[] {
    const suggestions: ChartSuggestion[] = []
    
    try {
      // Look for JSON blocks in the AI response
      const jsonMatches = aiResponse.match(/```json\n([\s\S]*?)\n```/g)
      
      if (jsonMatches) {
        jsonMatches.forEach(match => {
          const jsonContent = match.replace(/```json\n/, '').replace(/\n```/, '')
          try {
            const suggestion = JSON.parse(jsonContent) as ChartSuggestion
            suggestions.push(suggestion)
          } catch (parseError) {
            logger.error('[ChartSuggestion] Failed to parse JSON suggestion:', parseError)
          }
        })
      }
      
      // Also look for structured suggestions in text format
      const structuredSuggestions = this.parseStructuredText(aiResponse)
      suggestions.push(...structuredSuggestions)
      
    } catch (error) {
      logger.error('[ChartSuggestion] Error parsing AI response:', error)
    }
    
    return suggestions
  }
  
  /**
   * Parse structured text suggestions (like the example you provided)
   */
  private parseStructuredText(text: string): ChartSuggestion[] {
    const suggestions: ChartSuggestion[] = []
    
    // Look for CHART_SUGGESTION blocks
    const suggestionMatches = text.match(/CHART_SUGGESTION\n([\s\S]*?)\nEND_SUGGESTION/g)
    
    if (suggestionMatches) {
      suggestionMatches.forEach((match, index) => {
        try {
          const content = match.replace('CHART_SUGGESTION\n', '').replace('\nEND_SUGGESTION', '')
          const lines = content.split('\n').filter(line => line.trim())
          
          const suggestion: Partial<ChartSuggestion> = {
            id: `ai-suggestion-${Date.now()}-${index}`,
            confidence: 0.8,
            reasoning: 'Generated from AI text analysis',
            tags: [],
            priority: 'medium'
          }
          
          lines.forEach(line => {
            const [key, ...valueParts] = line.split(': ')
            const value = valueParts.join(': ').trim()
            
            switch (key.toLowerCase()) {
              case 'type':
                suggestion.type = value as any
                break
              case 'title':
                suggestion.title = value
                break
              case 'columns':
                if (suggestion.type === 'table') {
                  const columns = value.split(', ').map((col, i) => ({
                    key: col.toLowerCase().replace(/\s+/g, '_'),
                    label: col,
                    type: (i === 0 ? 'text' : 'number') as "number" | "percentage" | "date" | "text" | "currency",
                    sortable: true
                  }))
                  suggestion.tableConfig = { columns }
                } else {
                  const [x, y] = value.split(', ')
                  suggestion.chartConfig = { x, y: y ? [y] : undefined }
                }
                break
              case 'description':
                suggestion.description = value
                break
            }
          })
          
          if (suggestion.type && suggestion.title) {
            suggestions.push(suggestion as ChartSuggestion)
          }
        } catch (error) {
          logger.error('[ChartSuggestion] Error parsing structured text:', error)
        }
      })
    }
    
    return suggestions
  }
  
  /**
   * Apply data transformations to create the dataset for the chart
   */
  async transformData(data: DataRow[], transform: ChartSuggestion['dataTransform']): Promise<DataRow[]> {
    let result = [...data]
    
    try {
      // Apply column transformations first
      if (transform.columns) {
        result = this.applyColumnTransforms(result, transform.columns)
      }
      
      // Apply filters
      if (transform.filter) {
        result = this.applyFilters(result, transform.filter)
      }
      
      // Apply aggregations
      if (transform.aggregations) {
        result = this.applyAggregations(result, transform.aggregations, transform.groupBy)
      }
      
      // Apply sorting
      if (transform.orderBy) {
        result = this.applySorting(result, transform.orderBy)
      }
      
      // Apply limit
      if (transform.limit) {
        result = result.slice(0, transform.limit)
      }
      
      logger.debug('[ChartSuggestion] Data transformation complete:', {
        originalRows: data.length,
        transformedRows: result.length
      })
      
    } catch (error) {
      logger.error('[ChartSuggestion] Error transforming data:', error)
      throw error
    }
    
    return result
  }
  
  /**
   * Apply column transformations
   */
  private applyColumnTransforms(data: DataRow[], transforms: ColumnTransform[]): DataRow[] {
    return data.map(row => {
      const newRow = { ...row }
      
      transforms.forEach(transform => {
        try {
          const value = this.evaluateExpression(transform.expression, row)
          const key = transform.alias || transform.name
          newRow[key] = value
        } catch (error) {
          logger.warn(`[ChartSuggestion] Transform failed for ${transform.name}:`, error)
          newRow[transform.alias || transform.name] = null
        }
      })
      
      return newRow
    })
  }
  
  /**
   * Apply filters to data
   */
  private applyFilters(data: DataRow[], filters: FilterCondition[]): DataRow[] {
    return data.filter(row => {
      return filters.every(filter => {
        const value = row[filter.column]
        
        switch (filter.operator) {
          case 'equals':
            return value === filter.value
          case 'not_equals':
            return value !== filter.value
          case 'greater_than':
            return Number(value) > Number(filter.value)
          case 'less_than':
            return Number(value) < Number(filter.value)
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase())
          case 'not_contains':
            return !String(value).toLowerCase().includes(String(filter.value).toLowerCase())
          case 'in':
            return Array.isArray(filter.value) && filter.value.includes(value)
          case 'not_in':
            return Array.isArray(filter.value) && !filter.value.includes(value)
          case 'is_null':
            return value === null || value === undefined || value === ''
          case 'is_not_null':
            return value !== null && value !== undefined && value !== ''
          default:
            return true
        }
      })
    })
  }
  
  /**
   * Apply sorting
   */
  private applySorting(data: DataRow[], orderBy: OrderByCondition[]): DataRow[] {
    return [...data].sort((a, b) => {
      for (const order of orderBy) {
        const aVal = a[order.column]
        const bVal = b[order.column]
        
        let comparison = 0
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal
        } else {
          comparison = String(aVal).localeCompare(String(bVal))
        }
        
        if (comparison !== 0) {
          return order.direction === 'desc' ? -comparison : comparison
        }
      }
      return 0
    })
  }
  
  /**
   * Apply aggregations (simplified implementation)
   */
  private applyAggregations(data: DataRow[], aggregations: AggregationCondition[], groupBy?: string[]): DataRow[] {
    if (!groupBy || groupBy.length === 0) {
      // Global aggregation
      const result: DataRow = {}
      
      aggregations.forEach(agg => {
        const values = data.map(row => Number(row[agg.column])).filter(v => !isNaN(v))
        const key = agg.alias || `${agg.function}_${agg.column}`
        
        switch (agg.function) {
          case 'sum':
            result[key] = values.reduce((a, b) => a + b, 0)
            break
          case 'avg':
            result[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
            break
          case 'count':
            result[key] = values.length
            break
          case 'min':
            result[key] = Math.min(...values)
            break
          case 'max':
            result[key] = Math.max(...values)
            break
          case 'count_distinct':
            result[key] = new Set(values).size
            break
        }
      })
      
      return [result]
    }
    
    // Group by aggregation (simplified)
    const groups = new Map<string, DataRow[]>()
    
    data.forEach(row => {
      const groupKey = groupBy.map(col => row[col]).join('|')
      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(row)
    })
    
    return Array.from(groups.entries()).map(([groupKey, groupData]) => {
      const result: DataRow = {}
      
      // Add group by columns
      groupBy.forEach((col, index) => {
        result[col] = groupKey.split('|')[index]
      })
      
      // Add aggregations
      aggregations.forEach(agg => {
        const values = groupData.map(row => Number(row[agg.column])).filter(v => !isNaN(v))
        const key = agg.alias || `${agg.function}_${agg.column}`

        switch (agg.function) {
          case 'sum':
            result[key] = values.reduce((a, b) => a + b, 0)
            break
          case 'avg':
            result[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
            break
          case 'count':
            result[key] = values.length
            break
          case 'min':
            result[key] = Math.min(...values)
            break
          case 'max':
            result[key] = Math.max(...values)
            break
          case 'count_distinct':
            result[key] = new Set(values).size
            break
          case 'median':
            const sorted = [...values].sort((a, b) => a - b)
            const mid = Math.floor(sorted.length / 2)
            result[key] = sorted.length % 2 === 0
              ? (sorted[mid - 1] + sorted[mid]) / 2
              : sorted[mid]
            break
          case 'mode':
            const freq = new Map<number, number>()
            values.forEach(v => freq.set(v, (freq.get(v) || 0) + 1))
            let maxFreq = 0, mode = values[0]
            freq.forEach((f, v) => {
              if (f > maxFreq) { maxFreq = f; mode = v }
            })
            result[key] = mode
            break
          case 'std':
            const mean = values.reduce((a, b) => a + b, 0) / values.length
            const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
            result[key] = Math.sqrt(variance)
            break
          case 'variance':
            const avg = values.reduce((a, b) => a + b, 0) / values.length
            result[key] = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
            break
          case 'percentile':
            const p = agg.percentile || 50
            const sortedValues = [...values].sort((a, b) => a - b)
            const index = (p / 100) * (sortedValues.length - 1)
            const lower = Math.floor(index)
            const upper = Math.ceil(index)
            const weight = index % 1
            result[key] = lower === upper ? sortedValues[lower] : sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight
            break
        }
      })
      
      return result
    })
  }
  
  /**
   * Evaluate simple expressions (basic implementation)
   */
  private evaluateExpression(expression: string, row: DataRow): any {
    // Simple expression evaluator
    // In a real implementation, you'd want a proper SQL parser
    
    // Handle CAST operations
    if (expression.includes('CAST(')) {
      const castMatch = expression.match(/CAST\((.*?) AS (.*?)\)/)
      if (castMatch) {
        const [, valueExpr, type] = castMatch
        const value = this.evaluateExpression(valueExpr, row)
        
        switch (type.toLowerCase()) {
          case 'float':
          case 'decimal':
          case 'number':
            return parseFloat(String(value)) || 0
          case 'int':
          case 'integer':
            return parseInt(String(value)) || 0
          default:
            return String(value)
        }
      }
    }
    
    // Handle REPLACE operations
    if (expression.includes('REPLACE(')) {
      let result = expression
      const replacePattern = /REPLACE\((.*?), "(.*?)", "(.*?)"\)/g
      let match
      
      while ((match = replacePattern.exec(expression)) !== null) {
        const [fullMatch, valueExpr, searchValue, replaceValue] = match
        const value = this.evaluateExpression(valueExpr, row)
        const replaced = String(value).replace(new RegExp(searchValue, 'g'), replaceValue)
        result = result.replace(fullMatch, `"${replaced}"`)
      }
      
      return result.replace(/"/g, '')
    }
    
    // Handle basic column references
    if (row.hasOwnProperty(expression)) {
      return row[expression]
    }
    
    // Handle division
    if (expression.includes(' / ')) {
      const [left, right] = expression.split(' / ')
      const leftVal = this.evaluateExpression(left.trim(), row)
      const rightVal = this.evaluateExpression(right.trim(), row)
      return Number(leftVal) / Number(rightVal)
    }
    
    // Return as-is for literals
    return expression
  }
}

// Export singleton instance
export const chartSuggestionEngine = new ChartSuggestionEngine()