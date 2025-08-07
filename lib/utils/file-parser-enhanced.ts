import { DataRow } from '@/lib/store'
import { fileDataCache, getCacheKey } from './cache-manager'
import { parseExcelAllSheets, SheetData } from './file-parser-multi-sheet'
import { parseCSV } from './file-parser'

export interface ParseProgress {
  loaded: number
  total: number
  percentage: number
  stage: 'reading' | 'parsing' | 'analyzing' | 'complete'
  rowsProcessed?: number
  currentChunk?: number
  totalChunks?: number
  estimatedTimeRemaining?: number
  currentSheet?: string
  totalSheets?: number
}

export interface ParseOptions {
  chunkSize?: number
  maxFileSize?: number
  onProgress?: (progress: ParseProgress) => void
  signal?: AbortSignal
  parseAllSheets?: boolean
}

export interface EnhancedParseResult {
  sheets: Array<{
    name: string
    data: DataRow[]
    meta: {
      fields: string[]
      rowCount: number
      columnCount: number
    }
  }>
  fileInfo: {
    fileName: string
    fileSize: number
    parseTime: number
    totalSheets: number
    fileType: string
  }
  errors?: any[]
}

export async function parseFileEnhanced(
  file: File,
  options: ParseOptions = {}
): Promise<EnhancedParseResult> {
  const {
    maxFileSize = 50 * 1024 * 1024, // 50MB default
    onProgress,
    signal,
    parseAllSheets = true
  } = options

  const startTime = performance.now()
  
  // Validate file size
  if (file.size > maxFileSize) {
    throw new Error(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`)
  }

  // Validate file type
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
    throw new Error('Unsupported file type. Please upload a CSV or Excel file.')
  }

  // Check cache first
  const cacheKey = getCacheKey(file)
  const cachedResult = fileDataCache.get(cacheKey)
  
  if (cachedResult && cachedResult.sheets && !signal?.aborted) {
    // Simulate progress for cached results
    onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      stage: 'complete',
      rowsProcessed: cachedResult.sheets.reduce((acc: number, sheet: any) => acc + sheet.data.length, 0),
      totalSheets: cachedResult.sheets.length
    })

    return cachedResult as EnhancedParseResult
  }

  try {
    let result: EnhancedParseResult

    if (extension === 'csv') {
      // For CSV files, create a single sheet
      onProgress?.({
        loaded: 0,
        total: file.size,
        percentage: 30,
        stage: 'reading'
      })

      const data = await parseCSV(file)
      
      onProgress?.({
        loaded: file.size,
        total: file.size,
        percentage: 90,
        stage: 'analyzing'
      })

      result = {
        sheets: [{
          name: 'Sheet1',
          data,
          meta: {
            fields: Object.keys(data[0] || {}),
            rowCount: data.length,
            columnCount: Object.keys(data[0] || {}).length
          }
        }],
        fileInfo: {
          fileName: file.name,
          fileSize: file.size,
          parseTime: performance.now() - startTime,
          totalSheets: 1,
          fileType: 'csv'
        }
      }
    } else {
      // For Excel files, parse all sheets if requested
      onProgress?.({
        loaded: 0,
        total: file.size,
        percentage: 30,
        stage: 'reading'
      })

      const multiSheetResult = await parseExcelAllSheets(file)
      
      onProgress?.({
        loaded: file.size,
        total: file.size,
        percentage: 90,
        stage: 'analyzing',
        totalSheets: multiSheetResult.sheets.length
      })

      result = {
        sheets: multiSheetResult.sheets.map(sheet => ({
          name: sheet.name,
          data: sheet.data,
          meta: {
            fields: Object.keys(sheet.data[0] || {}),
            rowCount: sheet.rowCount,
            columnCount: sheet.columnCount
          }
        })),
        fileInfo: {
          fileName: file.name,
          fileSize: file.size,
          parseTime: performance.now() - startTime,
          totalSheets: multiSheetResult.sheets.length,
          fileType: extension
        }
      }
    }

    onProgress?.({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      stage: 'complete',
      totalSheets: result.sheets.length,
      rowsProcessed: result.sheets.reduce((acc, sheet) => acc + sheet.data.length, 0)
    })

    // Cache the result
    if (result.sheets.length > 0) {
      fileDataCache.set(cacheKey, result)
    }

    return result
  } catch (error) {
    if (signal?.aborted) {
      throw new Error('File parsing was cancelled')
    }
    throw error
  }
}