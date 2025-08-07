import { DataRow, AnalysisResult, ChartConfig } from '@/lib/store'

/**
 * Analyzes data using OpenAI GPT-4 for intelligent insights and visualization recommendations
 */
export async function analyzeData(
  data: DataRow[], 
  onProgress?: (progress: number, usingAI: boolean) => void
): Promise<AnalysisResult> {
  console.log('🔵 [AI-ANALYSIS] analyzeData called with data:', {
    dataLength: data?.length,
    dataType: typeof data,
    isArray: Array.isArray(data),
    firstRow: data?.[0],
    sampleKeys: data?.[0] ? Object.keys(data[0]) : null,
    timestamp: new Date().toISOString()
  })
  
  if (!data || data.length === 0) {
    console.error('❌ [AI-ANALYSIS] No data provided for analysis:', {
      data,
      hasData: !!data,
      dataLength: data?.length,
      dataType: typeof data,
      timestamp: new Date().toISOString()
    })
    throw new Error('No data provided for analysis')
  }

  try {
    console.log('🚀 [AI-ANALYSIS] Starting AI analysis process...')
    onProgress?.(20, true)
    
    // Call our API route for OpenAI analysis
    console.log('🔵 [AI-ANALYSIS] Making fetch request to /api/analyze...', {
      url: '/api/analyze',
      method: 'POST',
      dataLength: data.length,
      timestamp: new Date().toISOString()
    })
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout to match server
    
    const requestStartTime = Date.now()
    console.log('🔵 [AI-ANALYSIS] Sending request to API with payload size:', JSON.stringify({ data }).length, 'characters')
    
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    const requestDuration = Date.now() - requestStartTime
    console.log('✅ [AI-ANALYSIS] Fetch response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      duration: requestDuration + 'ms',
      timestamp: new Date().toISOString()
    })

    onProgress?.(70, true)

    if (!response.ok) {
      console.log('❌ [AI-ANALYSIS] API request failed, attempting to parse error...')
      const errorData = await response.json().catch((e) => {
        console.error('❌ [AI-ANALYSIS] Failed to parse error response:', e)
        return {}
      })
      
      console.error('❌ [AI-ANALYSIS] API error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        timestamp: new Date().toISOString()
      })
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.')
      } else if (response.status === 500 && errorData.error?.includes('API key')) {
        throw new Error('OpenAI API is not configured. Please check your environment variables.')
      } else {
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`)
      }
    }

    console.log('🔵 [AI-ANALYSIS] Parsing response JSON...')
    const result: AnalysisResult = await response.json()
    
    console.log('✅ [AI-ANALYSIS] Response parsed successfully:', {
      hasInsights: !!result.insights,
      insightsCount: result.insights?.length,
      hasChartConfig: !!result.chartConfig,
      chartCount: result.chartConfig?.length,
      hasSummary: !!result.summary,
      timestamp: new Date().toISOString()
    })
    
    onProgress?.(90, true)
    
    // Validate the response structure
    console.log('🔍 [AI-ANALYSIS] Validating response structure...')
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

    console.log('✅ [AI-ANALYSIS] Response validation successful')
    onProgress?.(100, true)
    console.log('🏁 [AI-ANALYSIS] Analysis completed successfully')
    return result

  } catch (error) {
    console.error('❌ [AI-ANALYSIS] Error in analyzeData:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
    throw error
  }
}

/**
 * Generates a basic analysis without AI when OpenAI is unavailable
 */
function generateBasicAnalysis(data: DataRow[]): AnalysisResult {
  console.log('generateBasicAnalysis called with data length:', data?.length)
  
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