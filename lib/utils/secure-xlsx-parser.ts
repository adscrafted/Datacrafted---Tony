/**
 * Secure XLSX Parser Wrapper
 *
 * Defense-in-depth security wrapper for xlsx library that provides:
 * 1. Enforcing file size limits (10MB max)
 * 2. Sanitizing parsed data to remove dangerous keys (__proto__, constructor, prototype)
 * 3. Enforcing row and column limits
 * 4. Deep sanitizing nested objects and arrays
 *
 * Security Notes:
 * - Using xlsx@0.20.3 from SheetJS CDN (patched for CVE-2023-30533 and GHSA-4r6h-8v6p-xvw6)
 * - Prototype pollution vulnerabilities fixed in xlsx 0.19.3+ (CVE-2023-30533)
 * - ReDoS vulnerability fixed in xlsx 0.20.2+ (GHSA-5pgg-2g8v-p4x9)
 * - Additional defense-in-depth protections applied even on patched version
 *
 * OWASP Reference: A08:2021 - Software and Data Integrity Failures
 * CWE-1321: Improperly Controlled Modification of Object Prototype Attributes (Prototype Pollution)
 * CWE-1333: Inefficient Regular Expression Complexity (ReDoS)
 *
 * @see https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/
 * @see https://github.com/advisories/GHSA-4r6h-8v6p-xvw6
 * @see https://github.com/advisories/GHSA-5pgg-2g8v-p4x9
 */

import * as XLSX from 'xlsx'

// Security Configuration
const SECURITY_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_ROWS: 10000,
  MAX_COLUMNS: 100,
  // Dangerous keys that can lead to prototype pollution
  DANGEROUS_KEYS: ['__proto__', 'constructor', 'prototype'],
} as const

/**
 * Security error class for tracking security violations
 */
export class XLSXSecurityError extends Error {
  constructor(
    message: string,
    public readonly violation: 'FILE_SIZE' | 'ROW_LIMIT' | 'COLUMN_LIMIT' | 'PROTOTYPE_POLLUTION'
  ) {
    super(message)
    this.name = 'XLSXSecurityError'
  }
}

/**
 * Check if a key is dangerous and could lead to prototype pollution
 */
function isDangerousKey(key: string): boolean {
  return (SECURITY_CONFIG.DANGEROUS_KEYS as readonly string[]).includes(key.toLowerCase())
}

/**
 * Deep sanitize an object to remove prototype pollution vectors
 *
 * This function recursively traverses objects and arrays to:
 * - Remove __proto__, constructor, and prototype keys
 * - Prevent nested prototype pollution attacks
 * - Preserve legitimate data structure
 *
 * @param obj - The object to sanitize
 * @returns Sanitized object free from prototype pollution vectors
 */
function deepSanitize<T>(obj: T): T {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle primitive types (string, number, boolean)
  if (typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item)) as T
  }

  // Handle objects
  const sanitized: any = {}

  for (const key in obj) {
    // Skip inherited properties
    if (!Object.prototype.hasOwnProperty.call(obj, key)) {
      continue
    }

    // Skip dangerous keys that could lead to prototype pollution
    if (isDangerousKey(key)) {
      console.warn(`[SECURITY] Blocked dangerous key "${key}" - potential prototype pollution attempt`)
      continue
    }

    // Recursively sanitize nested objects
    const value = (obj as any)[key]
    sanitized[key] = deepSanitize(value)
  }

  return sanitized as T
}

/**
 * Validate file size before processing
 */
function validateFileSize(file: File | ArrayBuffer | Uint8Array | number): void {
  let fileSize: number

  if (file instanceof File) {
    fileSize = file.size
  } else if (file instanceof ArrayBuffer) {
    fileSize = file.byteLength
  } else if (file instanceof Uint8Array) {
    fileSize = file.byteLength
  } else {
    fileSize = file
  }

  if (fileSize > SECURITY_CONFIG.MAX_FILE_SIZE) {
    throw new XLSXSecurityError(
      `File size ${fileSize} bytes exceeds maximum allowed size of ${SECURITY_CONFIG.MAX_FILE_SIZE} bytes (10MB)`,
      'FILE_SIZE'
    )
  }
}

/**
 * Validate and limit rows in parsed data
 */
function validateAndLimitRows<T extends any[]>(data: T): T {
  if (data.length > SECURITY_CONFIG.MAX_ROWS) {
    console.warn(
      `[SECURITY] Data contains ${data.length} rows, limiting to ${SECURITY_CONFIG.MAX_ROWS} rows`
    )
    throw new XLSXSecurityError(
      `Data contains ${data.length} rows, exceeds maximum of ${SECURITY_CONFIG.MAX_ROWS} rows`,
      'ROW_LIMIT'
    )
  }
  return data
}

/**
 * Validate column count in data
 */
function validateColumnCount(data: any[]): void {
  if (data.length === 0) return

  const firstRow = data[0]
  if (typeof firstRow !== 'object' || firstRow === null) return

  const columnCount = Object.keys(firstRow).length
  if (columnCount > SECURITY_CONFIG.MAX_COLUMNS) {
    throw new XLSXSecurityError(
      `Data contains ${columnCount} columns, exceeds maximum of ${SECURITY_CONFIG.MAX_COLUMNS} columns`,
      'COLUMN_LIMIT'
    )
  }
}

/**
 * Securely parse Excel file data
 *
 * @param data - File data to parse (binary string, ArrayBuffer, or File)
 * @param options - XLSX read options
 * @returns Workbook object with sanitized data
 */
export function secureXLSXRead(
  data: string | ArrayBuffer | Uint8Array,
  options: XLSX.ParsingOptions = { type: 'binary' }
): XLSX.WorkBook {
  // Validate file size
  if (typeof data !== 'string') {
    validateFileSize(data)
  }

  // Parse the workbook using xlsx
  const workbook = XLSX.read(data, options)

  // Sanitize sheet data to prevent prototype pollution
  for (const sheetName in workbook.Sheets) {
    if (Object.prototype.hasOwnProperty.call(workbook.Sheets, sheetName)) {
      workbook.Sheets[sheetName] = deepSanitize(workbook.Sheets[sheetName])
    }
  }

  return workbook
}

/**
 * Securely convert worksheet to JSON with sanitization
 *
 * @param worksheet - Worksheet to convert
 * @param options - Conversion options
 * @returns Sanitized JSON data array
 */
export function secureSheetToJson<T = any>(
  worksheet: XLSX.WorkSheet,
  options?: XLSX.Sheet2JSONOpts
): T[] {
  // Convert sheet to JSON using xlsx
  const jsonData = XLSX.utils.sheet_to_json(worksheet, options)

  // Validate row count
  validateAndLimitRows(jsonData)

  // Validate column count
  validateColumnCount(jsonData)

  // Deep sanitize the entire data structure
  const sanitizedData = deepSanitize(jsonData)

  return sanitizedData as T[]
}

/**
 * High-level secure Excel parsing function
 *
 * This is the main entry point for secure Excel parsing.
 * It combines file validation, parsing, and sanitization.
 *
 * @param file - File object to parse
 * @param options - Optional parsing configuration
 * @returns Promise resolving to sanitized data array
 *
 * @example
 * ```typescript
 * try {
 *   const data = await parseExcelSecurely(file, {
 *     sheetIndex: 0,
 *     dateFormat: 'yyyy-mm-dd'
 *   })
 *   console.log('Parsed data:', data)
 * } catch (error) {
 *   if (error instanceof XLSXSecurityError) {
 *     console.error('Security violation:', error.violation, error.message)
 *   }
 * }
 * ```
 */
export function parseExcelSecurely<T = any>(
  file: File,
  options: {
    sheetIndex?: number
    dateFormat?: string
    raw?: boolean
  } = {}
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      // Validate file size upfront
      validateFileSize(file)

      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = e.target?.result
          if (!data) {
            throw new Error('No data read from file')
          }

          // Securely read the workbook
          const workbook = secureXLSXRead(data, { type: 'binary' })

          // Get the requested sheet (default to first sheet)
          const sheetIndex = options.sheetIndex ?? 0
          const sheetName = workbook.SheetNames[sheetIndex]

          if (!sheetName) {
            throw new Error(`Sheet at index ${sheetIndex} not found`)
          }

          const worksheet = workbook.Sheets[sheetName]

          // Securely convert to JSON
          const sanitizedData = secureSheetToJson<T>(worksheet, {
            raw: options.raw ?? false,
            dateNF: options.dateFormat ?? 'yyyy-mm-dd',
          })

          resolve(sanitizedData)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = (error) => {
        reject(new Error(`Failed to read file: ${error}`))
      }

      reader.readAsBinaryString(file)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Parse all sheets in an Excel file securely
 *
 * @param file - File object to parse
 * @param options - Optional parsing configuration
 * @returns Promise resolving to array of sheets with sanitized data
 *
 * @example
 * ```typescript
 * const sheets = await parseExcelAllSheetsSecurely(file)
 * sheets.forEach(sheet => {
 *   console.log(`Sheet: ${sheet.name}, Rows: ${sheet.data.length}`)
 * })
 * ```
 */
export function parseExcelAllSheetsSecurely<T = any>(
  file: File,
  options: {
    dateFormat?: string
    raw?: boolean
    includeEmptySheets?: boolean
  } = {}
): Promise<Array<{ name: string; data: T[] }>> {
  return new Promise((resolve, reject) => {
    try {
      // Validate file size upfront
      validateFileSize(file)

      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const data = e.target?.result
          if (!data) {
            throw new Error('No data read from file')
          }

          // Securely read the workbook
          const workbook = secureXLSXRead(data, { type: 'binary' })

          const sheets: Array<{ name: string; data: T[] }> = []

          // Process each sheet
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName]

            // Securely convert to JSON
            const sanitizedData = secureSheetToJson<T>(worksheet, {
              raw: options.raw ?? false,
              dateNF: options.dateFormat ?? 'yyyy-mm-dd',
            })

            // Only include sheets with data unless includeEmptySheets is true
            if (sanitizedData.length > 0 || options.includeEmptySheets) {
              sheets.push({
                name: sheetName,
                data: sanitizedData,
              })
            }
          }

          resolve(sheets)
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = (error) => {
        reject(new Error(`Failed to read file: ${error}`))
      }

      reader.readAsBinaryString(file)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Export security configuration for testing and monitoring
 */
export const getSecurityConfig = () => ({ ...SECURITY_CONFIG })
