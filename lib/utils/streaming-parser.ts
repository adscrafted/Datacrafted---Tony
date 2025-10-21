import type { DataRow } from '@/lib/store'

export interface StreamingOptions {
  chunkSize?: number
  maxRows?: number
  onChunk?: (chunk: DataRow[], meta: { 
    totalRows: number
    currentRow: number
    progress: number
  }) => void
  onProgress?: (progress: {
    bytesRead: number
    totalBytes: number
    rowsProcessed: number
    percentage: number
  }) => void
  signal?: AbortSignal
  sampleSize?: number // For type inference on large files
}

export interface StreamingResult {
  data: DataRow[]
  meta: {
    totalRows: number
    fields: string[]
    parseTime: number
    bytesTotalRead: number
    wasStreamingUsed: boolean
    typeInference: Record<string, 'string' | 'number' | 'date' | 'boolean'>
  }
  errors?: any[]
}

class StreamingCSVParser {
  private decoder = new TextDecoder()
  private buffer = ''
  private headers: string[] = []
  private rowCount = 0
  private parsedData: DataRow[] = []
  private errors: any[] = []
  private typeInference: Record<string, 'string' | 'number' | 'date' | 'boolean'> = {}
  private sampleForInference: any[][] = []

  async parseFile(file: File, options: StreamingOptions = {}): Promise<StreamingResult> {
    const {
      chunkSize = 64 * 1024, // 64KB chunks
      maxRows = Infinity,
      onChunk,
      onProgress,
      signal,
      sampleSize = 1000
    } = options

    const startTime = performance.now()
    let bytesRead = 0
    
    // Reset state
    this.reset()

    try {
      const reader = file.stream().getReader()
      let isFirstChunk = true
      let headersParsed = false

      while (true) {
        if (signal?.aborted) {
          throw new Error('Parsing was cancelled')
        }

        const { done, value } = await reader.read()
        
        if (done) break

        // Update progress
        bytesRead += value.length
        const progress = (bytesRead / file.size) * 100

        onProgress?.({
          bytesRead,
          totalBytes: file.size,
          rowsProcessed: this.rowCount,
          percentage: progress
        })

        // Decode chunk and add to buffer
        const chunk = this.decoder.decode(value, { stream: true })
        this.buffer += chunk

        // Process complete lines
        const lines = this.buffer.split('\n')
        this.buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue // Skip empty lines

          if (!headersParsed) {
            this.headers = this.parseCSVLine(line)
            this.initializeTypeInference()
            headersParsed = true
            continue
          }

          const values = this.parseCSVLine(line)
          if (values.length !== this.headers.length) {
            this.errors.push({
              row: this.rowCount + 1,
              message: `Column count mismatch. Expected ${this.headers.length}, got ${values.length}`,
              line
            })
            continue
          }

          const row = this.createRowObject(values)
          this.parsedData.push(row)
          this.rowCount++

          // Collect samples for type inference
          if (this.sampleForInference.length < sampleSize) {
            this.sampleForInference.push(values)
          } else if (this.sampleForInference.length === sampleSize) {
            this.performTypeInference()
            this.sampleForInference = [] // Free memory
          }

          // Emit chunk if configured
          if (onChunk && this.rowCount % (chunkSize / 100) === 0) {
            onChunk([...this.parsedData], {
              totalRows: this.rowCount,
              currentRow: this.rowCount,
              progress
            })
          }

          // Check row limit
          if (this.rowCount >= maxRows) {
            break
          }
        }

        // Break if max rows reached
        if (this.rowCount >= maxRows) {
          break
        }
      }

      // Process remaining buffer
      if (this.buffer.trim() && headersParsed) {
        const values = this.parseCSVLine(this.buffer.trim())
        if (values.length === this.headers.length) {
          const row = this.createRowObject(values)
          this.parsedData.push(row)
          this.rowCount++
        }
      }

      // Final type inference if not done yet
      if (this.sampleForInference.length > 0) {
        this.performTypeInference()
      }

      const parseTime = performance.now() - startTime

      return {
        data: this.parsedData,
        meta: {
          totalRows: this.rowCount,
          fields: this.headers,
          parseTime,
          bytesTotalRead: bytesRead,
          wasStreamingUsed: true,
          typeInference: this.typeInference
        },
        errors: this.errors.length > 0 ? this.errors : undefined
      }

    } catch (error) {
      throw new Error(`Streaming parse failed: ${(error as Error).message}`)
    }
  }

  private reset() {
    this.buffer = ''
    this.headers = []
    this.rowCount = 0
    this.parsedData = []
    this.errors = []
    this.typeInference = {}
    this.sampleForInference = []
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"'
          i += 2
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
          i++
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim())
        current = ''
        i++
      } else {
        current += char
        i++
      }
    }

    // Add last field
    result.push(current.trim())

    return result
  }

  private createRowObject(values: string[]): DataRow {
    const row: DataRow = {}
    
    this.headers.forEach((header, index) => {
      const value = values[index]
      const inferredType = this.typeInference[header]
      
      // Apply type conversion based on inference
      if (!value || value === '') {
        row[header] = null
      } else {
        switch (inferredType) {
          case 'number':
            const num = Number(value)
            row[header] = isNaN(num) ? value : num
            break
          case 'boolean':
            const lower = value.toLowerCase()
            row[header] = ['true', '1', 'yes', 'y'].includes(lower)
            break
          case 'date':
            const date = new Date(value)
            row[header] = isNaN(date.getTime()) ? value : date
            break
          default:
            row[header] = value
        }
      }
    })

    return row
  }

  private initializeTypeInference() {
    this.headers.forEach(header => {
      this.typeInference[header] = 'string' // Default
    })
  }

  private performTypeInference() {
    if (this.sampleForInference.length === 0) return

    this.headers.forEach((header, colIndex) => {
      const values = this.sampleForInference
        .map(row => row[colIndex])
        .filter(val => val && val.trim() !== '')

      if (values.length === 0) {
        this.typeInference[header] = 'string'
        return
      }

      // Check for numbers
      const numericValues = values.filter(val => {
        const num = Number(val)
        return !isNaN(num) && isFinite(num)
      })

      if (numericValues.length / values.length > 0.8) {
        this.typeInference[header] = 'number'
        return
      }

      // Check for dates
      const dateValues = values.filter(val => {
        const dateStr = String(val).trim()

        // Reject pure numbers to avoid Date.parse false positives
        const isPureNumber = /^-?\d+(\.\d+)?$/.test(dateStr)
        const isYearLike = /^\d{4}$/.test(dateStr)
        if (isPureNumber && !isYearLike) return false

        return !isNaN(Date.parse(dateStr)) &&
               (dateStr.match(/\d{4}-\d{2}-\d{2}/) ||
                dateStr.match(/\d{2}\/\d{2}\/\d{4}/) ||
                dateStr.match(/\d{4}\/\d{2}\/\d{2}/))
      })

      if (dateValues.length / values.length > 0.8) {
        this.typeInference[header] = 'date'
        return
      }

      // Check for booleans
      const booleanValues = values.filter(val => {
        const str = String(val).toLowerCase()
        return ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(str)
      })

      if (booleanValues.length / values.length > 0.8) {
        this.typeInference[header] = 'boolean'
        return
      }

      // Default to string
      this.typeInference[header] = 'string'
    })
  }
}

// Factory function
export function createStreamingParser(): StreamingCSVParser {
  return new StreamingCSVParser()
}

// Convenience function for single file parsing
export async function parseFileStreaming(
  file: File,
  options: StreamingOptions = {}
): Promise<StreamingResult> {
  const parser = createStreamingParser()
  return parser.parseFile(file, options)
}

// Utility to decide whether to use streaming based on file size
export function shouldUseStreaming(file: File, threshold = 5 * 1024 * 1024): boolean {
  return file.size > threshold && file.name.toLowerCase().endsWith('.csv')
}