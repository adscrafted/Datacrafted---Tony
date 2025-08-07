/**
 * Web Worker for heavy data processing operations
 * Offloads CPU-intensive tasks from the main thread
 */

interface ProcessingMessage {
  type: 'PROCESS_DATA' | 'AGGREGATE_DATA' | 'FILTER_DATA' | 'SAMPLE_DATA'
  data: any
  config?: any
}

interface ProcessingResult {
  type: string
  result: any
  error?: string
}

// Data sampling logic (from data-sampling.ts)
function uniformSample<T>(data: T[], targetSize: number): T[] {
  if (data.length <= targetSize) return data
  
  const step = data.length / targetSize
  const sampled: T[] = []
  
  for (let i = 0; i < targetSize; i++) {
    const index = Math.floor(i * step)
    sampled.push(data[index])
  }
  
  return sampled
}

// Aggregate data for pie charts
function aggregateData(data: any[], keyField: string, valueField: string) {
  const aggregated = new Map<string, number>()
  
  data.forEach(row => {
    const key = String(row[keyField] || 'Unknown')
    const value = Number(row[valueField]) || 0
    aggregated.set(key, (aggregated.get(key) || 0) + value)
  })
  
  return Array.from(aggregated.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

// Filter data based on conditions
function filterData(data: any[], filters: any) {
  if (!filters || Object.keys(filters).length === 0) return data
  
  return data.filter(row => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === null || value === undefined) return true
      return row[key] === value
    })
  })
}

// Message handler
self.addEventListener('message', (event: MessageEvent<ProcessingMessage>) => {
  const { type, data, config } = event.data
  
  try {
    let result: any
    
    switch (type) {
      case 'PROCESS_DATA':
        // General data processing
        result = data
        break
        
      case 'AGGREGATE_DATA':
        result = aggregateData(data, config.keyField, config.valueField)
        break
        
      case 'FILTER_DATA':
        result = filterData(data, config.filters)
        break
        
      case 'SAMPLE_DATA':
        result = uniformSample(data, config.targetSize)
        break
        
      default:
        throw new Error(`Unknown message type: ${type}`)
    }
    
    const response: ProcessingResult = {
      type,
      result
    }
    
    self.postMessage(response)
  } catch (error) {
    const response: ProcessingResult = {
      type,
      result: null,
      error: error instanceof Error ? error.message : String(error)
    }
    
    self.postMessage(response)
  }
})

// Export for TypeScript
export {}