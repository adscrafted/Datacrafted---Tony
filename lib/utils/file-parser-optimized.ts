import type { DataRow } from '@/lib/store'
import { fileDataCache, getCacheKey } from './cache-manager'
import { parseCSV, parseExcel } from './file-parser'
import { parseFileStreaming } from './streaming-parser'

export interface ParseProgress {
  loaded: number
  total: number
  percentage: number
  stage: 'reading' | 'parsing' | 'analyzing' | 'complete'
  rowsProcessed?: number
  currentChunk?: number
  totalChunks?: number
  estimatedTimeRemaining?: number
}

export interface ParseOptions {
  chunkSize?: number
  maxFileSize?: number
  onProgress?: (progress: ParseProgress) => void
  signal?: AbortSignal
}

export interface ParseResult {
  data: DataRow[]
  meta: {
    fields: string[]
    rowCount: number
    parseTime: number
    fileSize: number
  }
  errors?: any[]
}

class FileParserOptimized {
  private worker: Worker | null = null
  private abortController: AbortController | null = null

  constructor() {
    this.initWorker()
  }

  private initWorker() {
    if (typeof window !== 'undefined') {
      try {
        // Dynamic import to avoid SSR issues
        this.worker = new Worker(
          new URL('../workers/file-parser.worker.ts', import.meta.url),
          { type: 'module' }
        )
      } catch (error) {
        console.warn('Web Worker not supported, falling back to main thread')
        this.worker = null
      }
    }
  }

  async parseFile(
    file: File, 
    options: ParseOptions = {}
  ): Promise<ParseResult> {
    const {
      maxFileSize = 50 * 1024 * 1024, // 50MB default
      onProgress,
      signal
    } = options

    // Check cache first
    const cacheKey = getCacheKey(file)
    const cachedResult = fileDataCache.get(cacheKey)
    
    if (cachedResult && cachedResult.data && !options.signal?.aborted) {
      // Simulate progress for cached results
      onProgress?.({
        loaded: file.size,
        total: file.size,
        percentage: 100,
        stage: 'complete',
        rowsProcessed: cachedResult.data.length
      })

      return {
        data: cachedResult.data,
        meta: cachedResult.meta || {
          fields: Object.keys(cachedResult.data[0] || {}),
          rowCount: cachedResult.data.length,
          parseTime: 0, // Cached result
          fileSize: file.size
        },
        errors: (cachedResult as any).errors
      }
    }

    // Validate file size
    if (file.size > maxFileSize) {
      throw new Error(`File size exceeds ${Math.round(maxFileSize / 1024 / 1024)}MB limit`)
    }

    // Validate file type
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      throw new Error('Unsupported file type. Please upload a CSV or Excel file.')
    }

    // Parse the file
    let result: ParseResult
    if (this.worker && !this.isMainThreadForced()) {
      result = await this.parseWithWorker(file, options)
    } else {
      result = await this.parseOnMainThread(file, options)
    }

    // Cache the result
    if (result.data.length > 0) {
      fileDataCache.set(cacheKey, {
        data: result.data,
        meta: result.meta
      })
    }

    return result
  }

  private async parseWithWorker(
    file: File,
    options: ParseOptions
  ): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not available'))
        return
      }

      const { onProgress, signal } = options
      let startTime = performance.now()

      // Set up abort handling
      if (signal) {
        signal.addEventListener('abort', () => {
          this.worker?.terminate()
          this.initWorker() // Reinitialize worker for next use
          reject(new Error('File parsing was cancelled'))
        })
      }

      // Handle worker messages
      this.worker.onmessage = (e) => {
        const { type, data, error } = e.data

        switch (type) {
          case 'progress':
            if (onProgress) {
              const progress = data as ParseProgress
              // Add estimated time remaining
              if (progress.percentage > 0) {
                const elapsed = performance.now() - startTime
                const estimatedTotal = (elapsed / progress.percentage) * 100
                progress.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed)
              }
              onProgress(progress)
            }
            break

          case 'complete':
            resolve(data as ParseResult)
            break

          case 'error':
            reject(new Error(error.message))
            break
        }
      }

      this.worker.onerror = (error) => {
        reject(new Error(`Worker error: ${error.message}`))
      }

      // Start parsing - don't pass onProgress callback (functions can't be cloned)
      // The worker will send progress messages back via postMessage
      this.worker.postMessage({
        type: 'parseFile',
        file,
        options: {
          chunkSize: options.chunkSize,
          maxFileSize: options.maxFileSize
          // Note: onProgress and signal are handled on main thread
        }
      })
    })
  }

  private async parseOnMainThread(
    file: File,
    options: ParseOptions
  ): Promise<ParseResult> {
    console.log('[PARSER] parseOnMainThread called', {
      fileName: file.name,
      fileSize: file.size,
      extension: file.name.split('.').pop()?.toLowerCase()
    })

    const { onProgress } = options
    const extension = file.name.split('.').pop()?.toLowerCase()

    try {
      // Use streaming parser for large CSV files
      if (extension === 'csv' && file.size > 5 * 1024 * 1024) { // 5MB threshold
        console.log('[PARSER] File qualifies for streaming parser (>5MB CSV)')

        try {
          console.log('[PARSER] Calling parseFileStreaming...')
          const result = await parseFileStreaming(file, {
            onProgress: (streamProgress) => {
              onProgress?.({
                loaded: streamProgress.bytesRead,
                total: streamProgress.totalBytes,
                percentage: streamProgress.percentage,
                stage: streamProgress.percentage < 30 ? 'reading' :
                       streamProgress.percentage < 90 ? 'parsing' : 'analyzing',
                rowsProcessed: streamProgress.rowsProcessed
              })
            },
            signal: options.signal
          })
          console.log('[PARSER] Streaming parse completed', {
            rowCount: result.data.length,
            parseTime: result.meta.parseTime
          })

          return {
            data: result.data,
            meta: {
              fields: result.meta.fields,
              rowCount: result.meta.totalRows,
              parseTime: result.meta.parseTime,
              fileSize: file.size
            },
            errors: result.errors
          }
        } catch (streamError) {
          console.error('[PARSER] Streaming parser failed:', streamError)
          console.log('[PARSER] Falling back to regular parser')
          // Fall through to regular parsing
        }
      }

      // Fallback to regular parsing for smaller files or Excel files
      console.log('[PARSER] Using regular parser for file')

      const startTime = performance.now()

      // Simulate progress reporting for main thread parsing
      let progress = 0
      const progressInterval = setInterval(() => {
        progress = Math.min(progress + 10, 90)
        onProgress?.({
          loaded: (file.size * progress) / 100,
          total: file.size,
          percentage: progress,
          stage: progress < 30 ? 'reading' : progress < 70 ? 'parsing' : 'analyzing'
        })
      }, 100)

      try {
        let data: DataRow[]
        console.log('[PARSER] Starting file parsing based on extension:', extension)

        switch (extension) {
          case 'csv':
            console.log('[PARSER] Calling parseCSV...')
            data = await parseCSV(file)
            console.log('[PARSER] parseCSV completed, rows:', data.length)
            break
          case 'xlsx':
          case 'xls':
            console.log('[PARSER] Calling parseExcel...')
            data = await parseExcel(file)
            console.log('[PARSER] parseExcel completed, rows:', data.length)
            break
          default:
            throw new Error('Unsupported file type')
        }

        clearInterval(progressInterval)
        console.log('[PARSER] Parse completed successfully')

        const parseTime = performance.now() - startTime

        onProgress?.({
          loaded: file.size,
          total: file.size,
          percentage: 100,
          stage: 'complete',
          rowsProcessed: data.length
        })

        return {
          data,
          meta: {
            fields: Object.keys(data[0] || {}),
            rowCount: data.length,
            parseTime,
            fileSize: file.size
          }
        }
      } catch (error) {
        console.error('[PARSER] Parse error in try block:', error)
        clearInterval(progressInterval)
        throw error
      }
    } catch (error) {
      console.error('[PARSER] parseOnMainThread error:', error)
      throw error
    }
  }

  private isMainThreadForced(): boolean {
    // Force main thread for small files or when debugging
    return process.env.NODE_ENV === 'development' || 
           (typeof window !== 'undefined' && window.location.search.includes('no-worker'))
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort()
    }
    if (this.worker) {
      this.worker.terminate()
      this.initWorker()
    }
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    if (this.abortController) {
      this.abortController.abort()
    }
  }
}

// Singleton instance
let parserInstance: FileParserOptimized | null = null

export function getFileParser(): FileParserOptimized {
  if (!parserInstance) {
    parserInstance = new FileParserOptimized()
  }
  return parserInstance
}

// Convenience function
export async function parseFileOptimized(
  file: File,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const parser = getFileParser()
  return parser.parseFile(file, options)
}

// Cleanup function for component unmounting
export function cleanupFileParser() {
  if (parserInstance) {
    parserInstance.destroy()
    parserInstance = null
  }
}