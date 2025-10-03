import { DataRow, DataSchema, ColumnSchema } from '@/lib/store'
import { schemaCache, getCacheKey } from './cache-manager'

// Enhanced date format patterns for better detection
const DATE_PATTERNS = [
  // ISO formats
  /^\d{4}-\d{2}-\d{2}$/,                          // 2023-01-01
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/,          // 2023-01-01T12:00 or 2023-01-01 12:00

  // US formats
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,                   // 1/1/2023 or 01/01/2023
  /^\d{1,2}-\d{1,2}-\d{4}$/,                       // 1-1-2023

  // EU formats
  /^\d{1,2}\.\d{1,2}\.\d{4}$/,                   // 01.01.2023

  // Natural language formats
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i, // Jan 1, 2023
  /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i,    // 1 Jan 2023
  /^\d{1,2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2,4}$/i,      // 09-Sep-25 or 09-Sep-2025
  /^\d{1,2}\/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{2,4}$/i,    // 09/Sep/25

  // Quarter formats
  /^Q[1-4]\s+\d{4}$/i,                              // Q1 2023
  /^\d{4}\s+Q[1-4]$/i,                              // 2023 Q1

  // Month-Year formats
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i,  // Jan 2023
  /^\d{4}-(0[1-9]|1[0-2])$/,                        // 2023-01

  // Year only
  /^\d{4}$/,                                         // 2023

  // Time only
  /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i         // 14:30 or 2:30 PM
]

export function detectDateWithConfidence(values: any[]): { isDate: boolean; confidence: number; format?: string } {
  if (!values || values.length === 0) {
    return { isDate: false, confidence: 0 }
  }

  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonNullValues.length === 0) {
    return { isDate: false, confidence: 0 }
  }

  let matchCount = 0
  let formatCounts: Record<string, number> = {}
  let parsableCount = 0

  for (const value of nonNullValues) {
    const str = String(value).trim()

    // CRITICAL FIX: Reject pure numbers before Date.parse()
    // Date.parse() incorrectly parses numbers like "1", "5", "37" as dates
    // e.g., "1" -> Jan 2001, "5" -> May 2001, "37" -> year 2037
    // Only allow numbers that match year patterns (e.g., "2023")
    const isPureNumber = /^-?\d+(\.\d+)?$/.test(str)
    const isYearLike = /^\d{4}$/.test(str) // 4-digit year is ok

    if (isPureNumber && !isYearLike) {
      // Skip pure numbers (except 4-digit years) to avoid false positives
      continue
    }

    // Check against our patterns FIRST (more reliable than Date.parse)
    let patternMatched = false
    for (let i = 0; i < DATE_PATTERNS.length; i++) {
      if (DATE_PATTERNS[i].test(str)) {
        matchCount++
        parsableCount++ // Pattern match implies parseable
        formatCounts[`pattern_${i}`] = (formatCounts[`pattern_${i}`] || 0) + 1
        patternMatched = true
        break
      }
    }

    // If no pattern matched, try Date.parse as fallback
    if (!patternMatched) {
      const parsed = Date.parse(str)
      if (!isNaN(parsed)) {
        parsableCount++
      }
    }
  }

  const matchRatio = matchCount / nonNullValues.length
  const parseRatio = parsableCount / nonNullValues.length

  // Calculate confidence based on multiple factors
  let confidence = 0
  if (matchRatio >= 0.8) {
    confidence = 90 + (matchRatio - 0.8) * 50 // 90-100% for very high match
  } else if (matchRatio >= 0.5) {
    confidence = 70 + (matchRatio - 0.5) * 40 // 70-90% for good match
  } else if (parseRatio >= 0.7) {
    confidence = 50 + (parseRatio - 0.7) * 67 // 50-70% for parseable dates
  } else {
    confidence = parseRatio * 50 // 0-50% for low match
  }

  // Detect the most common format
  let dominantFormat = ''
  if (Object.keys(formatCounts).length > 0) {
    dominantFormat = Object.entries(formatCounts)
      .sort((a, b) => b[1] - a[1])[0][0]
  }

  return {
    isDate: confidence >= 60, // 60% threshold for date detection
    confidence: Math.round(confidence),
    format: dominantFormat
  }
}

export function analyzeDataSchema(data: DataRow[], fileName: string, file?: File): DataSchema {
  if (!data || data.length === 0) {
    return {
      fileName,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      uploadedAt: new Date().toISOString()
    }
  }

  // Check cache first if file is provided
  if (file) {
    const cacheKey = getCacheKey(file)
    const cachedSchema = schemaCache.get(cacheKey)
    if (cachedSchema) {
      return cachedSchema
    }
  }

  // Generate cache key from data characteristics if no file provided
  const dataKey = file ? getCacheKey(file) : `data_${data.length}_${Object.keys(data[0] || {}).join('_')}`

  const columns = Object.keys(data[0] || {})
  const columnSchemas: ColumnSchema[] = columns.map(columnName => {
    const values = data.map(row => row[columnName])
    const nonNullValues = values.filter(v => v !== null && v !== undefined)
    const uniqueValues = new Set(nonNullValues)
    const nullCount = values.length - nonNullValues.length
    const nullPercentage = (nullCount / values.length) * 100

    // Determine column type with improved heuristics
    let type: ColumnSchema['type'] = 'string'
    let stats: ColumnSchema['stats'] = undefined
    let confidence = 0
    let detectionReason = ''

    if (nonNullValues.length > 0) {
      // First check column name patterns for strong hints
      const lowerColumnName = columnName.toLowerCase()

      // Enhanced Date/Time detection with confidence scoring
      const dateNamePatterns = [
        'date', 'time', 'datetime', 'timestamp',
        'created', 'updated', 'modified', 'deleted',
        'start', 'end', 'begin', 'expire',
        'dob', 'birth', 'joined', 'registered'
      ]

      const hasDateName = dateNamePatterns.some(pattern => lowerColumnName.includes(pattern)) ||
                         lowerColumnName.endsWith('_at') ||
                         lowerColumnName.endsWith('_on') ||
                         lowerColumnName.endsWith('_date')

      // Always check date patterns, but weight by column name
      const dateDetection = detectDateWithConfidence(nonNullValues)

      // Boost confidence if column name suggests date
      if (hasDateName && dateDetection.confidence > 30) {
        dateDetection.confidence = Math.min(100, dateDetection.confidence + 20)
        detectionReason = 'Column name and pattern match'
      } else if (dateDetection.confidence > 0) {
        detectionReason = 'Pattern match'
      }

      if (dateDetection.isDate) {
        type = 'date'
        confidence = dateDetection.confidence
      }

      // Numeric detection - improved patterns and percentage handling
      if (type === 'string') {
        const numericValues = nonNullValues
          .map(v => {
            const str = String(v).trim()
            // Handle percentages
            if (str.endsWith('%')) {
              const num = parseFloat(str.slice(0, -1))
              return isNaN(num) ? NaN : num
            }
            // Handle currency symbols (with optional space after symbol)
            if (str.match(/^[\$£€¥₹]\s?[\d,]+\.?\d*$/)) {
              const cleaned = str.replace(/[\$£€¥₹,\s]/g, '')
              return parseFloat(cleaned)
            }
            // Handle comma-separated thousands
            if (str.match(/^\d{1,3}(,\d{3})*(\.\d+)?$/)) {
              return parseFloat(str.replace(/,/g, ''))
            }
            // Regular number parsing
            const num = Number(str)
            return isNaN(num) || !isFinite(num) ? NaN : num
          })
          .filter(v => !isNaN(v))
        
        // Strong numeric indicators from column names
        const numericKeywords = [
          'amount', 'price', 'cost', 'revenue', 'total', 'sum', 'count', 
          'clicks', 'impressions', 'spend', 'budget', 'rate', 'ctr', 'roas',
          'sales', 'orders', 'quantity', 'qty', 'number', 'num', 'value',
          'percent', 'percentage', '%', 'metric', 'kpi'
        ]
        
        const hasNumericName = numericKeywords.some(keyword => 
          lowerColumnName.includes(keyword)
        )
        
        // If column name suggests numeric OR if 70%+ of values are numeric
        if (hasNumericName || numericValues.length >= nonNullValues.length * 0.7) {
          if (numericValues.length > 0) {
            type = 'number'
            const sorted = numericValues.sort((a, b) => a - b)
            const sum = numericValues.reduce((a, b) => a + b, 0)
            const mean = sum / numericValues.length
            const variance = numericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numericValues.length
            
            stats = {
              min: sorted[0],
              max: sorted[sorted.length - 1],
              avg: mean,
              median: sorted.length % 2 === 0 
                ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                : sorted[Math.floor(sorted.length / 2)],
              std: Math.sqrt(variance)
            }
          }
        }
      }
      
      // Boolean detection
      if (type === 'string') {
        const booleanValues = nonNullValues.filter(v => {
          const str = String(v).toLowerCase().trim()
          return ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 'on', 'off', 'active', 'inactive'].includes(str)
        })
        
        if (booleanValues.length >= nonNullValues.length * 0.8) {
          type = 'boolean'
        }
      }
      
      // Categorical detection - improved thresholds
      if (type === 'string') {
        const uniqueRatio = uniqueValues.size / nonNullValues.length
        const maxCategoricalValues = Math.min(100, Math.max(20, nonNullValues.length * 0.1))
        
        // Categorical if:
        // - Low unique count OR
        // - Low unique ratio and reasonable number of categories OR
        // - Column name suggests categorical data
        const categoricalKeywords = [
          'type', 'category', 'status', 'state', 'country', 'region', 'city',
          'campaign', 'channel', 'source', 'medium', 'device', 'browser',
          'gender', 'age_group', 'segment', 'class', 'grade', 'level'
        ]
        
        const hasCategoricalName = categoricalKeywords.some(keyword => 
          lowerColumnName.includes(keyword)
        )
        
        if (uniqueValues.size <= maxCategoricalValues && 
           (uniqueRatio < 0.5 || hasCategoricalName || uniqueValues.size <= 20)) {
          type = 'categorical'
        }
      }
    }

    // Suggest usage based on column name and type
    const suggestedUsage = getSuggestedUsage(columnName, type, uniqueValues.size, nonNullValues.length)
    
    // Generate description
    const description = generateColumnDescription(columnName, type, uniqueValues.size, nullPercentage)

    return {
      name: columnName,
      type,
      uniqueValues: uniqueValues.size,
      nullCount,
      nullPercentage,
      sampleValues: Array.from(uniqueValues).slice(0, 5),
      stats,
      description,
      suggestedUsage,
      confidence,
      detectionReason
    }
  })

  // Detect potential relationships
  const relationships = detectRelationships(columnSchemas, data)
  
  // Infer business context
  const businessContext = inferBusinessContext(columnSchemas, fileName)

  const schema: DataSchema = {
    fileName,
    rowCount: data.length,
    columnCount: columns.length,
    columns: columnSchemas,
    relationships,
    businessContext,
    uploadedAt: new Date().toISOString()
  }

  // Cache the result
  schemaCache.set(dataKey, schema)

  return schema
}

function getSuggestedUsage(columnName: string, type: ColumnSchema['type'], uniqueValues: number, totalValues: number): string[] {
  const usage: string[] = []
  const lowerName = columnName.toLowerCase()

  // Based on column name patterns - enhanced for marketing data
  if (lowerName.includes('id') || lowerName.includes('key')) {
    usage.push('identifier', 'grouping')
  }
  if (lowerName.includes('date') || lowerName.includes('time')) {
    usage.push('time-series', 'filtering', 'x-axis', 'temporal-analysis')
  }
  if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('cost') || 
      lowerName.includes('revenue') || lowerName.includes('spend') || lowerName.includes('budget')) {
    usage.push('measure', 'y-axis', 'aggregation', 'currency')
  }
  if (lowerName.includes('name') || lowerName.includes('title') || lowerName.includes('category') ||
      lowerName.includes('campaign') || lowerName.includes('portfolio')) {
    usage.push('dimension', 'grouping', 'filtering')
  }
  if (lowerName.includes('count') || lowerName.includes('total') || lowerName.includes('sum') ||
      lowerName.includes('clicks') || lowerName.includes('impressions') || lowerName.includes('orders')) {
    usage.push('measure', 'y-axis', 'aggregation', 'metric')
  }
  
  // Marketing-specific patterns
  if (lowerName.includes('ctr') || lowerName.includes('rate') || lowerName.includes('roas') ||
      lowerName.includes('percent') || lowerName.includes('%')) {
    usage.push('measure', 'y-axis', 'percentage', 'kpi')
  }
  if (lowerName.includes('country') || lowerName.includes('region') || lowerName.includes('city') ||
      lowerName.includes('state') || lowerName.includes('location')) {
    usage.push('dimension', 'geographic', 'grouping', 'filtering')
  }
  if (lowerName.includes('status') || lowerName.includes('type') || lowerName.includes('channel') ||
      lowerName.includes('source') || lowerName.includes('medium') || lowerName.includes('device')) {
    usage.push('dimension', 'categorical', 'grouping', 'filtering')
  }
  if (lowerName.includes('targeting') || lowerName.includes('bidding') || lowerName.includes('strategy')) {
    usage.push('dimension', 'categorical', 'strategy-analysis')
  }

  // Based on data type
  switch (type) {
    case 'number':
      if (!usage.includes('measure')) usage.push('measure')
      if (!usage.includes('y-axis')) usage.push('y-axis')
      usage.push('aggregation', 'comparison', 'trend-analysis')
      
      // Suggest specific chart types for metrics
      if (lowerName.includes('rate') || lowerName.includes('percent') || lowerName.includes('ctr')) {
        usage.push('line-chart', 'gauge-chart')
      }
      if (lowerName.includes('total') || lowerName.includes('sum') || lowerName.includes('count')) {
        usage.push('bar-chart', 'scorecard')
      }
      break
      
    case 'categorical':
      usage.push('dimension', 'grouping', 'filtering', 'x-axis')
      if (uniqueValues <= 10) {
        usage.push('pie-chart', 'donut-chart')
      }
      if (uniqueValues <= 20) {
        usage.push('bar-chart', 'column-chart')
      }
      break
      
    case 'date':
      usage.push('time-series', 'x-axis', 'filtering', 'line-chart', 'temporal-grouping')
      break
      
    case 'boolean':
      usage.push('filtering', 'segmentation', 'binary-analysis')
      break
      
    case 'string':
      // High cardinality strings are often identifiers or free text
      if (uniqueValues / totalValues > 0.8) {
        usage.push('identifier', 'high-cardinality')
      } else {
        usage.push('dimension', 'grouping', 'filtering')
      }
      break
  }

  // Based on cardinality and business context
  if (uniqueValues === totalValues) {
    usage.push('identifier', 'unique-key')
  } else if (uniqueValues / totalValues > 0.8) {
    usage.push('high-cardinality', 'potential-identifier')
  } else if (uniqueValues <= 5) {
    usage.push('low-cardinality', 'binary-or-limited', 'pie-chart')
  } else if (uniqueValues <= 20) {
    usage.push('moderate-cardinality', 'grouping', 'bar-chart')
  }

  return Array.from(new Set(usage))
}

function generateColumnDescription(columnName: string, type: ColumnSchema['type'], uniqueValues: number, nullPercentage: number): string {
  const lowerName = columnName.toLowerCase()
  let description = ''
  
  // Type-specific descriptions
  switch (type) {
    case 'number':
      if (lowerName.includes('rate') || lowerName.includes('percent') || lowerName.includes('ctr')) {
        description = 'Percentage metric'
      } else if (lowerName.includes('clicks')) {
        description = 'Click count metric'
      } else if (lowerName.includes('impressions')) {
        description = 'Impression count metric'
      } else if (lowerName.includes('spend') || lowerName.includes('cost')) {
        description = 'Cost/spend amount'
      } else if (lowerName.includes('budget')) {
        description = 'Budget allocation amount'
      } else if (lowerName.includes('revenue') || lowerName.includes('sales')) {
        description = 'Revenue metric'
      } else {
        description = 'Numeric value'
      }
      break
    case 'date':
      if (lowerName.includes('start')) {
        description = 'Period start date'
      } else if (lowerName.includes('end')) {
        description = 'Period end date'
      } else if (lowerName.includes('created')) {
        description = 'Creation timestamp'
      } else if (lowerName.includes('updated') || lowerName.includes('modified')) {
        description = 'Last update timestamp'
      } else {
        description = 'Date column'
      }
      break
    case 'categorical':
      if (lowerName.includes('campaign') && lowerName.includes('name')) {
        description = 'Campaign identifier'
      } else if (lowerName.includes('campaign') && lowerName.includes('type')) {
        description = 'Campaign classification'
      } else if (lowerName.includes('portfolio')) {
        description = 'Portfolio grouping'
      } else if (lowerName.includes('country')) {
        description = 'Geographic location'
      } else if (lowerName.includes('currency')) {
        description = 'Currency code'
      } else if (lowerName.includes('status')) {
        description = 'Current status'
      } else if (lowerName.includes('type')) {
        description = 'Type classification'
      } else if (lowerName.includes('strategy')) {
        description = 'Strategy type'
      } else if (lowerName.includes('targeting')) {
        description = 'Targeting configuration'
      } else {
        description = 'Category field'
      }
      break
    case 'boolean':
      description = 'True/false indicator'
      break
    default:
      if (lowerName.includes('name')) {
        description = 'Name identifier'
      } else if (lowerName.includes('id')) {
        description = 'Unique identifier'
      } else {
        description = 'Text field'
      }
  }
  
  // Add cardinality information
  if (uniqueValues === 1) {
    description += ' with constant value'
  } else if (type === 'categorical' && uniqueValues <= 5) {
    description += ' with few categories'
  } else if (type === 'categorical' && uniqueValues <= 20) {
    description += ' with limited categories'
  } else if (uniqueValues > 1000) {
    description += ' with high cardinality'
  }

  // Add data quality information only if there are issues
  if (nullPercentage > 50) {
    description += ' - mostly empty'
  } else if (nullPercentage > 20) {
    description += ' - has missing values'
  }
  // Don't add anything for complete data - it's the expected state

  return description
}

function detectRelationships(columns: ColumnSchema[], data: DataRow[]): DataSchema['relationships'] {
  const relationships: DataSchema['relationships'] = []
  
  // Simple heuristic: look for columns that might be foreign keys
  const idColumns = columns.filter(col => 
    col.name.toLowerCase().includes('id') && 
    col.type === 'number' || col.type === 'string'
  )
  
  for (const idCol of idColumns) {
    // Look for other columns that might reference this ID
    const potentialReferences = columns.filter(col => 
      col !== idCol && 
      col.name.toLowerCase().includes(idCol.name.toLowerCase().replace('id', '')) &&
      col.type === idCol.type
    )
    
    for (const refCol of potentialReferences) {
      relationships?.push({
        from: refCol.name,
        to: idCol.name,
        type: 'one-to-many'
      })
    }
  }
  
  return relationships
}

function inferBusinessContext(columns: ColumnSchema[], fileName: string): string {
  const columnNames = columns.map(c => c.name.toLowerCase()).join(' ')
  const fileNameLower = fileName.toLowerCase()
  
  // Business domain detection based on common patterns
  if (columnNames.includes('revenue') || columnNames.includes('sales') || columnNames.includes('price')) {
    return 'sales_analytics'
  }
  if (columnNames.includes('campaign') || columnNames.includes('click') || columnNames.includes('impression')) {
    return 'marketing_analytics'
  }
  if (columnNames.includes('user') || columnNames.includes('customer') || columnNames.includes('account')) {
    return 'customer_analytics'
  }
  if (columnNames.includes('product') || columnNames.includes('inventory') || columnNames.includes('sku')) {
    return 'product_analytics'
  }
  if (columnNames.includes('employee') || columnNames.includes('hr') || columnNames.includes('payroll')) {
    return 'hr_analytics'
  }
  if (fileNameLower.includes('finance') || columnNames.includes('budget') || columnNames.includes('cost')) {
    return 'financial_analytics'
  }
  
  return 'general_analytics'
}