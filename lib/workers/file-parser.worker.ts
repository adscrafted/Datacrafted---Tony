// Web Worker for file parsing to avoid blocking the main thread
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface ParseProgress {
  loaded: number
  total: number
  percentage: number
  stage: 'reading' | 'parsing' | 'analyzing' | 'complete'
  rowsProcessed?: number
  currentChunk?: number
  totalChunks?: number
}

export interface ParseResult {
  data: any[]
  meta?: {
    fields: string[]
    rowCount: number
    parseTime: number
    fileSize: number
  }
  errors?: any[]
}

const CHUNK_SIZE = 10000 // Process 10k rows at a time
const MAX_MEMORY_USAGE = 100 * 1024 * 1024 // 100MB limit

// Progress reporting function
function reportProgress(progress: ParseProgress) {
  self.postMessage({ type: 'progress', data: progress })
}

// Memory usage check
function checkMemoryUsage() {
  if ('memory' in performance) {
    const memInfo = (performance as any).memory
    return memInfo.usedJSHeapSize
  }
  return 0
}

// Chunked CSV parsing for large files
async function parseCSVChunked(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now()
    let allData: any[] = []
    let currentChunk = 0
    let totalRows = 0
    let fields: string[] = []
    let errors: any[] = []

    reportProgress({
      loaded: 0,
      total: file.size,
      percentage: 0,
      stage: 'reading'
    })

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      chunkSize: CHUNK_SIZE * 1024, // 10MB chunks
      
      chunk: (results, parser) => {
        currentChunk++
        const chunkData = results.data as any[]
        
        // Memory check
        const memoryUsage = checkMemoryUsage()
        if (memoryUsage > MAX_MEMORY_USAGE) {
          parser.abort()
          reject(new Error('File too large - exceeds memory limit'))
          return
        }

        // Store field names from first chunk
        if (fields.length === 0 && results.meta?.fields) {
          fields = results.meta.fields
        }

        // Accumulate data
        allData = allData.concat(chunkData)
        totalRows += chunkData.length

        // Collect errors
        if (results.errors && results.errors.length > 0) {
          errors = errors.concat(results.errors)
        }

        // Report progress
        reportProgress({
          loaded: (parser as any).streamer?._input?.length || 0,
          total: file.size,
          percentage: Math.min((((parser as any).streamer?._input?.length || 0) / file.size) * 100, 100),
          stage: 'parsing',
          rowsProcessed: totalRows,
          currentChunk
        })
      },

      complete: (results) => {
        const parseTime = performance.now() - startTime

        reportProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100,
          stage: 'complete',
          rowsProcessed: totalRows
        })

        resolve({
          data: allData,
          meta: {
            fields,
            rowCount: totalRows,
            parseTime,
            fileSize: file.size
          },
          errors: errors.length > 0 ? errors : undefined
        })
      },

      error: (error) => {
        reject(new Error(`CSV parsing failed: ${error.message}`))
      }
    })
  })
}

// Optimized Excel parsing with progress tracking
async function parseExcelOptimized(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now()
    const reader = new FileReader()

    reportProgress({
      loaded: 0,
      total: file.size,
      percentage: 0,
      stage: 'reading'
    })

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        reportProgress({
          loaded: e.loaded,
          total: e.total,
          percentage: (e.loaded / e.total) * 50, // Reading is 50% of the process
          stage: 'reading'
        })
      }
    }

    reader.onload = (e) => {
      try {
        reportProgress({
          loaded: file.size,
          total: file.size,
          percentage: 50,
          stage: 'parsing'
        })

        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })

        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Get range to estimate progress
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1')
        const totalCells = (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1)

        reportProgress({
          loaded: file.size,
          total: file.size,
          percentage: 75,
          stage: 'analyzing'
        })

        // Convert to JSON with progress simulation
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false,
          dateNF: 'yyyy-mm-dd'
        })

        const parseTime = performance.now() - startTime

        reportProgress({
          loaded: file.size,
          total: file.size,
          percentage: 100,
          stage: 'complete',
          rowsProcessed: jsonData.length
        })

        resolve({
          data: jsonData,
          meta: {
            fields: Object.keys(jsonData[0] || {}),
            rowCount: jsonData.length,
            parseTime,
            fileSize: file.size
          }
        })
      } catch (error) {
        reject(new Error(`Excel parsing failed: ${(error as Error).message}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsBinaryString(file)
  })
}

// Main message handler
self.onmessage = async (e) => {
  const { type, file, options = {} } = e.data

  try {
    if (type === 'parseFile') {
      const extension = file.name.split('.').pop()?.toLowerCase()
      let result: ParseResult

      switch (extension) {
        case 'csv':
          result = await parseCSVChunked(file)
          break
        case 'xlsx':
        case 'xls':
          result = await parseExcelOptimized(file)
          break
        default:
          throw new Error('Unsupported file type. Please upload a CSV or Excel file.')
      }

      self.postMessage({
        type: 'complete',
        data: result
      })
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: {
        message: (error as Error).message,
        stack: (error as Error).stack
      }
    })
  }
}

// Handle worker termination
self.onclose = () => {
  // Cleanup if needed
}

export {}