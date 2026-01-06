import type { DataRow, DataSchema, ColumnSchema, ColumnRole, SemanticType } from '@/lib/store'
import { schemaCache, getCacheKey } from './cache-manager'

// Re-export types from store for external use
export type { ColumnRole, SemanticType }

/**
 * Result of inferring column metadata from its name
 */
interface ColumnNameInference {
  suggestedType?: ColumnSchema['type']
  suggestedRole?: ColumnRole
  suggestedSemanticType?: SemanticType
  suggestedDescription?: string
}

// ============================================================================
// DATE DETECTION PATTERNS
// ============================================================================

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

// ============================================================================
// COLUMN NAME PATTERN MATCHING
// ============================================================================

/**
 * Pattern definitions for inferring column metadata from names
 */
const COLUMN_NAME_PATTERNS: Array<{
  patterns: RegExp[]
  keywords: string[]
  inference: ColumnNameInference
}> = [
  // Date/Time patterns
  {
    patterns: [/_at$/, /_on$/, /_date$/],
    keywords: ['date', 'time', 'created', 'updated', 'timestamp', 'datetime', 'modified', 'deleted', 'start', 'end', 'begin', 'expire', 'dob', 'birth', 'joined', 'registered'],
    inference: {
      suggestedType: 'date',
      suggestedRole: 'timestamp',
      suggestedSemanticType: 'datetime',
      suggestedDescription: 'Date/time field for temporal analysis'
    }
  },
  // Identifier patterns
  {
    patterns: [/_id$/, /^id$/, /_key$/, /_code$/],
    keywords: ['id', 'key', 'code', 'uuid', 'guid', 'sku', 'ref', 'reference'],
    inference: {
      suggestedRole: 'identifier',
      suggestedSemanticType: 'id',
      suggestedDescription: 'Unique identifier field'
    }
  },
  // Currency/Revenue patterns
  {
    patterns: [],
    keywords: ['revenue', 'price', 'cost', 'amount', 'total', 'fee', 'salary', 'wage', 'budget', 'spend', 'income', 'expense', 'profit', 'margin', 'payment', 'value'],
    inference: {
      suggestedType: 'number',
      suggestedRole: 'metric',
      suggestedSemanticType: 'currency',
      suggestedDescription: 'Monetary value for financial analysis'
    }
  },
  // Count patterns
  {
    patterns: [/^num_/, /^number_of_/, /^n_/],
    keywords: ['count', 'qty', 'quantity', 'total', 'sum', 'clicks', 'impressions', 'views', 'visits', 'sessions', 'users', 'orders', 'items'],
    inference: {
      suggestedType: 'number',
      suggestedRole: 'metric',
      suggestedSemanticType: 'count',
      suggestedDescription: 'Count metric for aggregation'
    }
  },
  // Percentage/Rate patterns
  {
    patterns: [/_pct$/, /_percent$/, /_rate$/],
    keywords: ['percent', 'pct', 'rate', 'ratio', 'ctr', 'cvr', 'roas', 'roi', 'conversion', 'bounce', 'churn', 'retention'],
    inference: {
      suggestedType: 'number',
      suggestedRole: 'metric',
      suggestedSemanticType: 'percentage',
      suggestedDescription: 'Percentage or rate metric'
    }
  },
  // Score/Rating patterns
  {
    patterns: [],
    keywords: ['score', 'rating', 'rank', 'grade', 'level', 'quality', 'priority', 'weight'],
    inference: {
      suggestedType: 'number',
      suggestedRole: 'metric',
      suggestedSemanticType: 'score',
      suggestedDescription: 'Score or rating value'
    }
  },
  // Email patterns
  {
    patterns: [/email/i],
    keywords: ['email', 'e_mail', 'mail'],
    inference: {
      suggestedType: 'string',
      suggestedSemanticType: 'email',
      suggestedDescription: 'Email address field'
    }
  },
  // URL patterns
  {
    patterns: [/url/i, /link/i],
    keywords: ['url', 'link', 'website', 'webpage', 'site', 'href'],
    inference: {
      suggestedType: 'string',
      suggestedSemanticType: 'url',
      suggestedDescription: 'URL or web link'
    }
  },
  // Phone patterns
  {
    patterns: [],
    keywords: ['phone', 'tel', 'mobile', 'cell', 'fax', 'telephone'],
    inference: {
      suggestedType: 'string',
      suggestedSemanticType: 'phone',
      suggestedDescription: 'Phone number field'
    }
  },
  // Name/Title patterns
  {
    patterns: [],
    keywords: ['name', 'title', 'label', 'description', 'display'],
    inference: {
      suggestedType: 'string',
      suggestedRole: 'dimension',
      suggestedSemanticType: 'name',
      suggestedDescription: 'Name or label for identification'
    }
  },
  // Status/Category patterns
  {
    patterns: [],
    keywords: ['status', 'state', 'type', 'category', 'class', 'group', 'segment', 'tier', 'channel', 'source', 'medium', 'device', 'platform', 'gender', 'age_group'],
    inference: {
      suggestedType: 'categorical',
      suggestedRole: 'dimension',
      suggestedSemanticType: 'category',
      suggestedDescription: 'Categorical dimension for grouping'
    }
  },
  // Address patterns
  {
    patterns: [],
    keywords: ['address', 'street', 'city', 'country', 'zip', 'postal', 'region', 'state', 'province', 'location', 'geo'],
    inference: {
      suggestedType: 'string',
      suggestedSemanticType: 'address',
      suggestedDescription: 'Geographic or address field'
    }
  }
]

/**
 * Infer column metadata from column name using pattern matching
 */
function inferFromColumnName(columnName: string): ColumnNameInference {
  const lowerName = columnName.toLowerCase()

  for (const pattern of COLUMN_NAME_PATTERNS) {
    // Check regex patterns first (more specific)
    for (const regex of pattern.patterns) {
      if (regex.test(lowerName)) {
        return { ...pattern.inference }
      }
    }

    // Check keyword matches
    for (const keyword of pattern.keywords) {
      if (lowerName.includes(keyword)) {
        return { ...pattern.inference }
      }
    }
  }

  return {}
}

// ============================================================================
// RANDOM SAMPLING
// ============================================================================

/**
 * Get a random sample of rows from the dataset
 * Uses Fisher-Yates shuffle variant for efficient sampling
 */
function getRandomSample(data: DataRow[], sampleSize: number = 100): DataRow[] {
  if (data.length <= sampleSize) return data

  const indices = new Set<number>()
  const dataLength = data.length

  // Use Set for O(1) lookup to avoid duplicates
  while (indices.size < sampleSize) {
    indices.add(Math.floor(Math.random() * dataLength))
  }

  return Array.from(indices).map(i => data[i])
}

// ============================================================================
// DATE DETECTION
// ============================================================================

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

// ============================================================================
// ROLE INFERENCE
// ============================================================================

/**
 * Infer the role of a column based on its data characteristics
 */
function inferColumnRole(
  type: ColumnSchema['type'],
  uniqueValues: number,
  totalValues: number,
  numericStats?: { min: number; max: number; std: number },
  nameInference?: ColumnNameInference
): ColumnRole {
  // If name inference already suggests a role, use it
  if (nameInference?.suggestedRole) {
    return nameInference.suggestedRole
  }

  const uniqueRatio = uniqueValues / totalValues

  // Date columns are timestamps
  if (type === 'date') {
    return 'timestamp'
  }

  // Check for identifier patterns
  if (type === 'string' || type === 'number') {
    // High cardinality + unique = likely identifier
    if (uniqueRatio > 0.9 && uniqueValues === totalValues) {
      return 'identifier'
    }

    // Sequential numbers with unique values = likely identifier
    if (type === 'number' && numericStats) {
      const isSequential = numericStats.max - numericStats.min === totalValues - 1
      if (isSequential && uniqueValues === totalValues) {
        return 'identifier'
      }
    }
  }

  // Numeric columns with high variance = likely metrics
  if (type === 'number' && numericStats) {
    // High coefficient of variation suggests metric
    const mean = (numericStats.max + numericStats.min) / 2
    const cv = mean !== 0 ? numericStats.std / Math.abs(mean) : 0

    if (cv > 0.3 || uniqueRatio > 0.5) {
      return 'metric'
    }

    // Few unique numeric values = could be dimension (e.g., ratings 1-5)
    if (uniqueValues <= 10 && uniqueRatio < 0.1) {
      return 'dimension'
    }

    return 'metric' // Default for numbers
  }

  // String columns with moderate cardinality = dimensions
  if (type === 'string' || type === 'categorical') {
    return 'dimension'
  }

  // Boolean = dimension
  if (type === 'boolean') {
    return 'dimension'
  }

  return 'dimension' // Default fallback
}

// ============================================================================
// MAIN SCHEMA ANALYSIS
// ============================================================================

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

  // Use random sampling for large datasets
  const sampleData = getRandomSample(data, 100)

  const columns = Object.keys(data[0] || {})
  const columnSchemas: ColumnSchema[] = columns.map(columnName => {
    // Sample values from random sample for type detection
    const sampleValues = sampleData.map(row => row[columnName])

    // Get all values for accurate cardinality and null counts
    const allValues = data.map(row => row[columnName])
    const nonNullValues = allValues.filter(v => v !== null && v !== undefined)
    const uniqueValues = new Set(nonNullValues)
    const nullCount = allValues.length - nonNullValues.length
    const nullPercentage = (nullCount / allValues.length) * 100

    // Infer from column name FIRST
    const nameInference = inferFromColumnName(columnName)
    const inferredFromName = Object.keys(nameInference).length > 0

    // Determine column type with improved heuristics
    let type: ColumnSchema['type'] = nameInference.suggestedType || 'string'
    let stats: ColumnSchema['stats'] = undefined
    let confidence = 0
    let detectionReason = ''

    if (nonNullValues.length > 0) {
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

      // Always check date patterns using sample data
      const dateDetection = detectDateWithConfidence(sampleValues.filter(v => v !== null && v !== undefined))

      // Boost confidence if column name suggests date
      if (hasDateName && dateDetection.confidence > 30) {
        dateDetection.confidence = Math.min(100, dateDetection.confidence + 20)
        detectionReason = 'Column name and pattern match'
      } else if (dateDetection.confidence > 0) {
        detectionReason = 'Pattern match'
      }

      // Use name inference if it suggests date and data partially supports it
      if (nameInference.suggestedType === 'date' && dateDetection.confidence > 30) {
        type = 'date'
        confidence = Math.max(dateDetection.confidence, 70) // Boost for name match
        detectionReason = inferredFromName ? 'Column name hint + pattern match' : 'Pattern match'
      } else if (dateDetection.isDate) {
        type = 'date'
        confidence = dateDetection.confidence
      }

      // Numeric detection - improved patterns and percentage handling
      if (type === 'string' && nameInference.suggestedType !== 'date') {
        const numericValues = nonNullValues
          .slice(0, 100) // Use sample for numeric detection
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

        // Boost confidence if name suggests numeric
        const numericThreshold = hasNumericName ? 0.5 : 0.7

        // If column name suggests numeric OR if sufficient values are numeric
        if (hasNumericName || numericValues.length >= nonNullValues.slice(0, 100).length * numericThreshold) {
          if (numericValues.length > 0) {
            type = nameInference.suggestedType === 'number' ? 'number' : 'number'
            confidence = hasNumericName ? Math.max(confidence, 80) : Math.max(confidence, 70)

            if (inferredFromName && hasNumericName) {
              detectionReason = 'Column name hint + numeric values'
            }

            // Calculate stats from all numeric values
            const allNumericValues = nonNullValues
              .map(v => {
                const str = String(v).trim()
                if (str.endsWith('%')) return parseFloat(str.slice(0, -1))
                if (str.match(/^[\$£€¥₹]\s?[\d,]+\.?\d*$/)) return parseFloat(str.replace(/[\$£€¥₹,\s]/g, ''))
                if (str.match(/^\d{1,3}(,\d{3})*(\.\d+)?$/)) return parseFloat(str.replace(/,/g, ''))
                const num = Number(str)
                return isNaN(num) || !isFinite(num) ? NaN : num
              })
              .filter(v => !isNaN(v))

            if (allNumericValues.length > 0) {
              const sorted = allNumericValues.sort((a, b) => a - b)
              const sum = allNumericValues.reduce((a, b) => a + b, 0)
              const mean = sum / allNumericValues.length
              const variance = allNumericValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / allNumericValues.length

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
      }

      // Boolean detection
      if (type === 'string') {
        const booleanValues = nonNullValues.slice(0, 100).filter(v => {
          const str = String(v).toLowerCase().trim()
          return ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 'on', 'off', 'active', 'inactive'].includes(str)
        })

        if (booleanValues.length >= nonNullValues.slice(0, 100).length * 0.8) {
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
          if (hasCategoricalName && inferredFromName) {
            confidence = Math.max(confidence, 85)
            detectionReason = 'Column name hint + low cardinality'
          }
        }
      }
    }

    // Infer role based on type and characteristics
    const role = inferColumnRole(
      type,
      uniqueValues.size,
      nonNullValues.length,
      stats ? { min: stats.min!, max: stats.max!, std: stats.std! } : undefined,
      nameInference
    )

    // Suggest usage based on column name, type, and role
    const suggestedUsage = getSuggestedUsage(columnName, type, uniqueValues.size, nonNullValues.length, role)

    // Generate description - use name inference if available, otherwise generate
    const description = nameInference.suggestedDescription ||
      generateColumnDescription(columnName, type, uniqueValues.size, nullPercentage, role, nameInference.suggestedSemanticType)

    // Final confidence boost for name inference match
    if (inferredFromName && confidence < 75) {
      confidence = Math.max(confidence, 75)
    }

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
      detectionReason: inferredFromName
        ? (detectionReason ? `${detectionReason} (inferred from name)` : 'Inferred from column name')
        : detectionReason,
      // Enhanced schema fields
      role,
      semanticType: nameInference.suggestedSemanticType || 'generic',
      inferredFromName,
      suggestedDescription: nameInference.suggestedDescription || description
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

function getSuggestedUsage(
  columnName: string,
  type: ColumnSchema['type'],
  uniqueValues: number,
  totalValues: number,
  role?: ColumnRole
): string[] {
  const usage: string[] = []
  const lowerName = columnName.toLowerCase()

  // Add role-based suggestions first
  if (role) {
    switch (role) {
      case 'identifier':
        usage.push('identifier', 'grouping', 'unique-key')
        break
      case 'dimension':
        usage.push('dimension', 'grouping', 'filtering')
        break
      case 'metric':
        usage.push('measure', 'y-axis', 'aggregation')
        break
      case 'timestamp':
        usage.push('time-series', 'x-axis', 'temporal-analysis')
        break
    }
  }

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

function generateColumnDescription(
  columnName: string,
  type: ColumnSchema['type'],
  uniqueValues: number,
  nullPercentage: number,
  role?: ColumnRole,
  semanticType?: SemanticType
): string {
  const lowerName = columnName.toLowerCase()
  let description = ''

  // Use semantic type for more specific descriptions
  if (semanticType) {
    switch (semanticType) {
      case 'currency':
        description = 'Monetary value'
        break
      case 'count':
        description = 'Count metric'
        break
      case 'percentage':
      case 'ratio':
        description = 'Rate or percentage'
        break
      case 'score':
        description = 'Score or rating'
        break
      case 'email':
        description = 'Email address'
        break
      case 'phone':
        description = 'Phone number'
        break
      case 'url':
        description = 'Web URL'
        break
      case 'address':
      case 'city':
      case 'country':
      case 'zip':
        description = 'Geographic location'
        break
      case 'id':
      case 'uuid':
      case 'sku':
        description = 'Unique identifier'
        break
      case 'category':
      case 'status':
        description = 'Categorical value'
        break
      case 'name':
      case 'label':
        description = 'Name or label'
        break
      case 'date':
      case 'datetime':
      case 'time':
        description = 'Date/time value'
        break
    }
  }

  // Fall back to type-based descriptions if no semantic type match
  if (!description) {
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
  }

  // Add role context
  if (role) {
    switch (role) {
      case 'identifier':
        if (!description.toLowerCase().includes('identifier')) {
          description += ' (identifier)'
        }
        break
      case 'metric':
        if (!description.toLowerCase().includes('metric')) {
          description += ' for aggregation'
        }
        break
      case 'timestamp':
        if (!description.toLowerCase().includes('time')) {
          description += ' for temporal analysis'
        }
        break
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

  return description
}

function detectRelationships(columns: ColumnSchema[], data: DataRow[]): DataSchema['relationships'] {
  const relationships: DataSchema['relationships'] = []

  // Simple heuristic: look for columns that might be foreign keys
  const idColumns = columns.filter(col =>
    col.name.toLowerCase().includes('id') &&
    (col.type === 'number' || col.type === 'string')
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
