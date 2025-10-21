import type { DataRow } from '@/lib/store'

/**
 * Smart sampling algorithms for large datasets
 * Preserves data distribution while reducing volume for visualization
 */

export interface SamplingOptions {
  preserveFirst?: number // Always include first N rows
  preserveLast?: number  // Always include last N rows
  method?: 'uniform' | 'stratified' | 'random'
}

/**
 * Uniformly sample data to maintain temporal/sequential distribution
 */
export function uniformSample<T = DataRow>(
  data: T[], 
  targetSize: number
): T[] {
  if (data.length <= targetSize) return data
  
  const step = data.length / targetSize
  const sampled: T[] = []
  
  for (let i = 0; i < targetSize; i++) {
    const index = Math.floor(i * step)
    sampled.push(data[index])
  }
  
  return sampled
}

/**
 * Smart sampling that preserves data characteristics
 */
export function smartSample<T extends Record<string, any> = DataRow>(
  data: T[],
  targetSize: number,
  options: SamplingOptions = {}
): T[] {
  const {
    preserveFirst = 0,
    preserveLast = 0,
    method = 'uniform'
  } = options
  
  if (data.length <= targetSize) return data
  
  const result: T[] = []
  
  // Preserve first N rows if requested
  if (preserveFirst > 0) {
    result.push(...data.slice(0, preserveFirst))
  }
  
  // Calculate remaining slots
  const remainingSize = targetSize - preserveFirst - preserveLast
  const middleData = data.slice(preserveFirst, data.length - preserveLast)
  
  // Apply sampling method
  let sampled: T[]
  switch (method) {
    case 'random':
      sampled = randomSample(middleData, remainingSize)
      break
    case 'stratified':
      sampled = stratifiedSample(middleData, remainingSize)
      break
    case 'uniform':
    default:
      sampled = uniformSample(middleData, remainingSize)
  }
  
  result.push(...sampled)
  
  // Preserve last N rows if requested
  if (preserveLast > 0) {
    result.push(...data.slice(-preserveLast))
  }
  
  return result
}

/**
 * Random sampling
 */
function randomSample<T>(data: T[], targetSize: number): T[] {
  const shuffled = [...data].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, targetSize)
}

/**
 * Stratified sampling - maintains distribution of categorical values
 */
function stratifiedSample<T extends Record<string, any>>(
  data: T[], 
  targetSize: number,
  stratifyBy?: keyof T
): T[] {
  if (!stratifyBy || data.length === 0) {
    return uniformSample(data, targetSize)
  }
  
  // Group by stratification key
  const groups = new Map<any, T[]>()
  data.forEach(item => {
    const key = item[stratifyBy]
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  })
  
  // Sample proportionally from each group
  const result: T[] = []
  const ratio = targetSize / data.length
  
  groups.forEach((groupData, key) => {
    const groupSize = Math.max(1, Math.round(groupData.length * ratio))
    result.push(...uniformSample(groupData, groupSize))
  })
  
  // Trim to exact target size if needed
  return result.slice(0, targetSize)
}

/**
 * Get optimal sample size based on chart type and data characteristics
 */
export function getOptimalSampleSize(
  dataLength: number,
  chartType: string,
  screenWidth?: number
): number {
  // Base limits by chart type
  const limits: Record<string, number> = {
    'line': 500,
    'bar': 100,
    'scatter': 1000,
    'pie': 20,
    'area': 500,
    'heatmap': 10000
  }
  
  let baseLimit = limits[chartType] || 500
  
  // Adjust based on screen size if provided
  if (screenWidth) {
    const factor = Math.min(screenWidth / 1920, 1.5)
    baseLimit = Math.floor(baseLimit * factor)
  }
  
  // Return minimum of data length and calculated limit
  return Math.min(dataLength, baseLimit)
}