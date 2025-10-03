import { DataRow, AnalysisResult, ChartConfig } from '@/lib/store'

/**
 * Analyzes data using OpenAI GPT-4 for intelligent insights and visualization recommendations
 */
// Global abort controller to cancel previous requests
let currentController: AbortController | null = null

export async function analyzeData(
  data: DataRow[],
  onProgress?: (progress: number, usingAI: boolean) => void
): Promise<AnalysisResult> {
  if (!data || data.length === 0) {
    console.error('❌ [AI-ANALYSIS] No data provided for analysis')
    throw new Error('No data provided for analysis')
  }

  // Cancel any previous ongoing request
  if (currentController) {
    currentController.abort()
    currentController = null
  }

  // Create new controller for this request (outside try block so catch can access it)
  const controller = new AbortController()
  currentController = controller

  try {
    let currentProgress = 10
    onProgress?.(currentProgress, true)

    // Simulate incremental progress during the request
    const progressInterval = setInterval(() => {
      // Gradually increase progress from 10% to 70% over time
      if (currentProgress < 70) {
        currentProgress = Math.min(70, currentProgress + 5)
        onProgress?.(currentProgress, true)
      }
    }, 2000) // Update every 2 seconds

    const timeoutId = setTimeout(() => {
      console.warn('⚠️ [AI-ANALYSIS] Request timeout after 120 seconds')
      controller.abort()
    }, 120000) // 120 second timeout (2 minutes) to allow for large datasets and complex analysis

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)
    clearInterval(progressInterval)
    currentController = null // Clear the controller after successful response
    onProgress?.(80, true)

    if (!response.ok) {
      const errorData = await response.json().catch((e) => {
        console.error('❌ [AI-ANALYSIS] Failed to parse error response:', e)
        return {}
      })

      console.error('❌ [AI-ANALYSIS] API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      })

      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.')
      } else if (response.status === 500 && errorData.error?.includes('API key')) {
        throw new Error('OpenAI API is not configured. Please check your environment variables.')
      } else {
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`)
      }
    }

    const result: AnalysisResult = await response.json()
    onProgress?.(90, true)

    // CRITICAL LOGGING: Check what frontend receives from API
    console.log('🔍 [AI-ANALYSIS] ===== RECEIVED FROM API =====')
    console.log('🔍 [AI-ANALYSIS] result.chartConfig.length:', result?.chartConfig?.length || 0)
    console.log('🔍 [AI-ANALYSIS] Chart titles received:', result?.chartConfig?.map(c => c.title).join(', '))
    console.log('🔍 [AI-ANALYSIS] Chart types received:', result?.chartConfig?.map(c => c.type).join(', '))
    console.log('🔍 [AI-ANALYSIS] ===== END RECEIVED =====')

    // Validate the response structure
    if (!result.insights || !Array.isArray(result.insights)) {
      console.error('❌ [AI-ANALYSIS] Invalid insights format:', result.insights)
      throw new Error('Invalid analysis response format')
    }

    if (!result.chartConfig || !Array.isArray(result.chartConfig)) {
      console.error('❌ [AI-ANALYSIS] Invalid chartConfig format:', result.chartConfig)
      throw new Error('Invalid chart configuration in response')
    }

    if (!result.summary || typeof result.summary !== 'object') {
      console.error('❌ [AI-ANALYSIS] Invalid summary format:', result.summary)
      throw new Error('Invalid summary in response')
    }

    onProgress?.(100, true)

    // CRITICAL LOGGING: Check what we're returning to the app
    console.log('✅ [AI-ANALYSIS] ===== RETURNING TO APP =====')
    console.log('✅ [AI-ANALYSIS] result.chartConfig.length:', result?.chartConfig?.length || 0)
    console.log('✅ [AI-ANALYSIS] Chart titles returning:', result?.chartConfig?.map(c => c.title).join(', '))
    console.log('✅ [AI-ANALYSIS] ===== END RETURNING =====')

    return result

  } catch (error) {
    // Clear the controller reference
    if (currentController === controller) {
      currentController = null
    }

    // Handle abort errors gracefully - they're expected when we cancel duplicate requests
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('⚠️ [AI-ANALYSIS] Request was cancelled (likely due to a new request or timeout)')
      throw new Error('Analysis request was cancelled. Please try again.')
    }

    console.error('❌ [AI-ANALYSIS] Error in analyzeData:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

/**
 * Generates a basic analysis without AI when OpenAI is unavailable
 */
function generateBasicAnalysis(data: DataRow[]): AnalysisResult {
  if (!data || data.length === 0) {
    throw new Error('No data provided for analysis')
  }

  // Analyze data structure
  const columns = Object.keys(data[0] || {})
  const columnInfo = columns.map(col => {
    const values = data.map(row => row[col])
    const nonNullValues = values.filter(v => v !== null && v !== undefined)
    const uniqueValues = new Set(nonNullValues)
    
    // Determine column type
    let type = 'string'
    if (nonNullValues.length > 0) {
      if (nonNullValues.every(v => typeof v === 'number' && !isNaN(v))) {
        type = 'number'
      } else if (nonNullValues.every(v => v instanceof Date || (!isNaN(Date.parse(String(v))) && String(v).match(/\d{4}-\d{2}-\d{2}/)))) {
        type = 'date'
      } else if (uniqueValues.size < Math.max(5, nonNullValues.length * 0.1)) {
        type = 'categorical'
      }
    }
    
    return {
      name: col,
      type,
      uniqueValues: uniqueValues.size,
      nullCount: values.length - nonNullValues.length
    }
  })

  // Find numeric and categorical columns
  const numericColumns = columnInfo.filter(c => c.type === 'number')
  const categoricalColumns = columnInfo.filter(c => c.type === 'categorical')
  const dateColumns = columnInfo.filter(c => c.type === 'date')

  // Generate insights
  const insights: string[] = [
    `Dataset contains ${data.length} rows and ${columns.length} columns`,
    `Found ${numericColumns.length} numeric columns, ${categoricalColumns.length} categorical columns, and ${dateColumns.length} date columns`
  ]

  // Add specific insights based on data
  if (numericColumns.length > 0) {
    insights.push(`Numeric columns available for analysis: ${numericColumns.map(c => c.name).join(', ')}`)
  }
  if (categoricalColumns.length > 0) {
    insights.push(`Categorical columns for grouping: ${categoricalColumns.map(c => c.name).join(', ')}`)
  }

  // Generate chart configurations
  const chartConfig: ChartConfig[] = []

  // Add a scorecard for the first numeric column if available
  if (numericColumns.length > 0) {
    const primaryMetric = numericColumns[0]
    const values = data.map(row => Number(row[primaryMetric.name]) || 0)
    const total = values.reduce((a, b) => a + b, 0)
    
    chartConfig.push({
      type: 'scorecard',
      title: `Total ${primaryMetric.name}`,
      description: `Sum of all ${primaryMetric.name} values`,
      dataKey: [primaryMetric.name]
    })
  }

  // Add bar chart if we have categorical and numeric data
  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    chartConfig.push({
      type: 'bar',
      title: `${numericColumns[0].name} by ${categoricalColumns[0].name}`,
      description: `Comparison of ${numericColumns[0].name} across different ${categoricalColumns[0].name} categories`,
      dataKey: [categoricalColumns[0].name, numericColumns[0].name]
    })
  }

  // Add line chart for time series or multiple numeric columns
  if (dateColumns.length > 0 && numericColumns.length > 0) {
    chartConfig.push({
      type: 'line',
      title: `${numericColumns[0].name} Over Time`,
      description: `Trend of ${numericColumns[0].name} over ${dateColumns[0].name}`,
      dataKey: [dateColumns[0].name, numericColumns[0].name]
    })
  } else if (numericColumns.length >= 2) {
    chartConfig.push({
      type: 'line',
      title: 'Numeric Values Comparison',
      description: 'Comparison of multiple numeric values',
      dataKey: numericColumns.slice(0, 3).map(c => c.name)
    })
  }

  // Add pie chart for categorical distribution
  if (categoricalColumns.length > 0) {
    const catCol = categoricalColumns[0]
    if (catCol.uniqueValues <= 10) {
      chartConfig.push({
        type: 'pie',
        title: `Distribution of ${catCol.name}`,
        description: `Breakdown by ${catCol.name} categories`,
        dataKey: [catCol.name]
      })
    }
  }

  // Add scatter plot if we have 2+ numeric columns
  if (numericColumns.length >= 2) {
    chartConfig.push({
      type: 'scatter',
      title: `${numericColumns[0].name} vs ${numericColumns[1].name}`,
      description: `Correlation between ${numericColumns[0].name} and ${numericColumns[1].name}`,
      dataKey: [numericColumns[0].name, numericColumns[1].name]
    })
  }

  // Ensure we have at least some charts
  if (chartConfig.length === 0) {
    // Fallback: create a simple bar chart with first two columns
    if (columns.length >= 2) {
      chartConfig.push({
        type: 'bar',
        title: `${columns[1]} by ${columns[0]}`,
        description: 'Data distribution',
        dataKey: [columns[0], columns[1]]
      })
    }
  }

  return {
    insights,
    chartConfig,
    summary: {
      rowCount: data.length,
      columnCount: columns.length,
      columns: columnInfo,
      dataQuality: 'Basic analysis performed without AI',
      keyFindings: 'OpenAI API unavailable - showing basic statistical analysis',
      recommendations: 'For advanced insights, ensure OpenAI API key is configured and try again'
    }
  }
}