/**
 * Comprehensive File Upload Validation Utility
 *
 * Security Features:
 * - File size validation
 * - MIME type validation (with magic byte verification)
 * - File extension validation
 * - File name sanitization
 * - Protection against path traversal attacks
 * - Double extension detection
 * - Null byte injection prevention
 *
 * OWASP References:
 * - OWASP Top 10 A03:2021 - Injection
 * - OWASP Top 10 A05:2021 - Security Misconfiguration
 * - CWE-434: Unrestricted Upload of File with Dangerous Type
 * - CWE-22: Improper Limitation of a Pathname to a Restricted Directory
 *
 * @see https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/09-Test_Upload_of_Malicious_Files
 */

import path from 'path'

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Default maximum file size: 10MB for data files
 * This can be overridden per file type in validation options
 */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Maximum file size for different categories
 */
export const FILE_SIZE_LIMITS = {
  DATA_FILE: 50 * 1024 * 1024,  // 50MB for CSV, Excel, JSON
  IMAGE: 5 * 1024 * 1024,        // 5MB for images
  DOCUMENT: 10 * 1024 * 1024,    // 10MB for documents
} as const

/**
 * Allowed MIME types for data files
 * Using strict whitelist approach (defense in depth)
 */
export const ALLOWED_MIME_TYPES = {
  CSV: ['text/csv', 'application/csv', 'text/plain'],
  EXCEL: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
  ],
  JSON: ['application/json', 'text/json'],
  TEXT: ['text/plain'],
} as const

/**
 * All allowed MIME types (flattened)
 */
export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_MIME_TYPES.CSV,
  ...ALLOWED_MIME_TYPES.EXCEL,
  ...ALLOWED_MIME_TYPES.JSON,
  ...ALLOWED_MIME_TYPES.TEXT,
]

/**
 * Allowed file extensions (without the dot)
 */
export const ALLOWED_EXTENSIONS = [
  'csv',
  'xls',
  'xlsx',
  'xlsm',
  'json',
  'txt',
] as const

/**
 * Magic bytes (file signatures) for verification
 * First few bytes of a file that identify its type
 *
 * @see https://en.wikipedia.org/wiki/List_of_file_signatures
 */
export const FILE_SIGNATURES = {
  // Excel formats
  XLSX: [0x50, 0x4B, 0x03, 0x04],           // PK.. (ZIP format)
  XLS: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1], // OLE2 format

  // Note: CSV, JSON, and TXT are text files with no magic bytes
  // They will be validated through content inspection
} as const

/**
 * Dangerous file extensions that should never be allowed
 * Even with double extension tricks like file.csv.exe
 */
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js',
  'jar', 'app', 'deb', 'rpm', 'dmg', 'pkg', 'sh', 'ps1',
  'dll', 'so', 'dylib', 'sys', 'drv', 'ocx',
  'htm', 'html', 'svg', 'xml', 'php', 'asp', 'aspx', 'jsp',
]

/**
 * Maximum filename length (including extension)
 */
const MAX_FILENAME_LENGTH = 255

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FileValidationOptions {
  /**
   * Maximum file size in bytes
   * @default DEFAULT_MAX_FILE_SIZE (10MB)
   */
  maxSize?: number

  /**
   * Allowed MIME types
   * @default ALL_ALLOWED_MIME_TYPES
   */
  allowedMimeTypes?: string[]

  /**
   * Allowed file extensions (without the dot)
   * @default ALLOWED_EXTENSIONS
   */
  allowedExtensions?: string[]

  /**
   * Whether to perform magic byte validation
   * @default true
   */
  validateMagicBytes?: boolean

  /**
   * Whether to check for dangerous double extensions
   * @default true
   */
  checkDoubleExtensions?: boolean

  /**
   * Custom validation function
   * Return error message string if validation fails, null if passes
   */
  customValidator?: (file: FileToValidate) => string | null
}

export interface FileToValidate {
  /**
   * Original filename from user
   */
  name: string

  /**
   * File size in bytes
   */
  size: number

  /**
   * MIME type provided by browser/client
   */
  type: string

  /**
   * File content as Buffer (for magic byte validation)
   */
  buffer?: Buffer
}

export interface FileValidationResult {
  /**
   * Whether the file passed all validation checks
   */
  valid: boolean

  /**
   * Human-readable error message if validation failed
   */
  error?: string

  /**
   * Error code for programmatic handling
   */
  errorCode?: string

  /**
   * Sanitized filename safe for storage
   */
  sanitizedName?: string

  /**
   * Detected MIME type from magic bytes (if different from provided)
   */
  detectedMimeType?: string

  /**
   * HTTP status code to return to client
   */
  httpStatus?: number
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validates a file upload against security best practices
 *
 * Performs comprehensive validation including:
 * 1. File name sanitization and length check
 * 2. File size validation
 * 3. Extension validation (whitelist)
 * 4. MIME type validation (whitelist)
 * 5. Magic byte verification (if buffer provided)
 * 6. Double extension detection
 * 7. Path traversal prevention
 * 8. Null byte injection prevention
 *
 * @param file - File to validate
 * @param options - Validation options
 * @returns Validation result with sanitized filename or error details
 *
 * @example
 * ```typescript
 * const file = {
 *   name: 'data.csv',
 *   size: 1024000,
 *   type: 'text/csv',
 *   buffer: fileBuffer
 * }
 *
 * const result = validateFile(file, {
 *   maxSize: 10 * 1024 * 1024,
 *   allowedMimeTypes: ALLOWED_MIME_TYPES.CSV
 * })
 *
 * if (!result.valid) {
 *   return res.status(result.httpStatus).json({ error: result.error })
 * }
 *
 * // Use result.sanitizedName for storage
 * ```
 */
export function validateFile(
  file: FileToValidate,
  options: FileValidationOptions = {}
): FileValidationResult {
  // Apply defaults
  const opts: Required<Omit<FileValidationOptions, 'customValidator'>> & Pick<FileValidationOptions, 'customValidator'> = {
    maxSize: options.maxSize || DEFAULT_MAX_FILE_SIZE,
    allowedMimeTypes: options.allowedMimeTypes || ALL_ALLOWED_MIME_TYPES,
    allowedExtensions: options.allowedExtensions || [...ALLOWED_EXTENSIONS],
    validateMagicBytes: options.validateMagicBytes !== false,
    checkDoubleExtensions: options.checkDoubleExtensions !== false,
    customValidator: options.customValidator,
  }

  // 1. Validate filename exists
  if (!file.name || typeof file.name !== 'string') {
    return {
      valid: false,
      error: 'Filename is required',
      errorCode: 'MISSING_FILENAME',
      httpStatus: 400,
    }
  }

  // 2. Check for null byte injection (CWE-158)
  if (file.name.includes('\0')) {
    return {
      valid: false,
      error: 'Invalid filename: contains null bytes',
      errorCode: 'NULL_BYTE_INJECTION',
      httpStatus: 400,
    }
  }

  // 3. Sanitize filename
  const sanitizedName = sanitizeFileName(file.name)

  if (!sanitizedName) {
    return {
      valid: false,
      error: 'Invalid filename: could not sanitize',
      errorCode: 'INVALID_FILENAME',
      httpStatus: 400,
    }
  }

  // 4. Check filename length
  if (sanitizedName.length > MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      error: `Filename too long (max ${MAX_FILENAME_LENGTH} characters)`,
      errorCode: 'FILENAME_TOO_LONG',
      httpStatus: 400,
    }
  }

  // 5. Validate file size
  if (!file.size || file.size <= 0) {
    return {
      valid: false,
      error: 'File is empty',
      errorCode: 'EMPTY_FILE',
      httpStatus: 400,
    }
  }

  if (file.size > opts.maxSize) {
    const maxSizeMB = (opts.maxSize / (1024 * 1024)).toFixed(2)
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
      errorCode: 'FILE_TOO_LARGE',
      httpStatus: 413, // Payload Too Large
    }
  }

  // 6. Validate file extension
  const extensionResult = validateFileExtension(sanitizedName, opts.allowedExtensions)
  if (!extensionResult.valid) {
    return {
      valid: false,
      error: extensionResult.error || 'Invalid file extension',
      errorCode: 'INVALID_EXTENSION',
      httpStatus: 415, // Unsupported Media Type
    }
  }

  // 7. Check for dangerous double extensions
  if (opts.checkDoubleExtensions) {
    const doubleExtResult = checkDangerousDoubleExtension(sanitizedName)
    if (!doubleExtResult.valid) {
      return {
        valid: false,
        error: doubleExtResult.error || 'Dangerous file extension detected',
        errorCode: 'DANGEROUS_EXTENSION',
        httpStatus: 400,
      }
    }
  }

  // 8. Validate MIME type
  const mimeResult = validateMimeType(file.type, opts.allowedMimeTypes)
  if (!mimeResult.valid) {
    return {
      valid: false,
      error: mimeResult.error || 'Invalid file type',
      errorCode: 'INVALID_MIME_TYPE',
      httpStatus: 415, // Unsupported Media Type
    }
  }

  // 9. Validate magic bytes if buffer provided
  if (opts.validateMagicBytes && file.buffer) {
    const magicByteResult = validateMagicBytes(file.buffer, sanitizedName)
    if (!magicByteResult.valid) {
      return {
        valid: false,
        error: magicByteResult.error || 'File type mismatch detected',
        errorCode: 'MAGIC_BYTE_MISMATCH',
        httpStatus: 400,
        detectedMimeType: magicByteResult.detectedType,
      }
    }
  }

  // 10. Run custom validator if provided
  if (opts.customValidator) {
    const customError = opts.customValidator(file)
    if (customError) {
      return {
        valid: false,
        error: customError,
        errorCode: 'CUSTOM_VALIDATION_FAILED',
        httpStatus: 400,
      }
    }
  }

  // All validations passed
  return {
    valid: true,
    sanitizedName,
  }
}

// ============================================================================
// FILENAME SANITIZATION
// ============================================================================

/**
 * Sanitizes a filename to prevent security issues
 *
 * Security measures:
 * - Removes path traversal sequences (../, ..\)
 * - Removes null bytes
 * - Removes control characters
 * - Normalizes Unicode characters
 * - Removes leading/trailing dots and spaces
 * - Preserves extension
 * - Replaces unsafe characters with underscores
 *
 * @param name - Original filename
 * @returns Sanitized filename or empty string if invalid
 */
export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') {
    return ''
  }

  // Remove any path components (prevent directory traversal)
  let sanitized = path.basename(name)

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')

  // Remove control characters (ASCII 0-31 and 127)
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // Normalize Unicode (prevent homograph attacks)
  sanitized = sanitized.normalize('NFD')

  // Remove leading/trailing dots and spaces
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, '')

  // Replace unsafe characters with underscores
  // Allow: alphanumeric, dots, hyphens, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_')

  // Prevent multiple consecutive dots (could indicate double extension)
  sanitized = sanitized.replace(/\.{2,}/g, '.')

  // Ensure filename isn't empty after sanitization
  if (!sanitized || sanitized === '.') {
    return ''
  }

  return sanitized
}

// ============================================================================
// MIME TYPE VALIDATION
// ============================================================================

/**
 * Validates MIME type against whitelist
 *
 * Uses strict whitelist approach - only explicitly allowed types pass
 * Case-insensitive comparison
 *
 * @param mimeType - MIME type to validate
 * @param allowedTypes - Array of allowed MIME types
 * @returns Validation result
 */
export function validateMimeType(
  mimeType: string,
  allowedTypes: string[]
): { valid: boolean; error?: string } {
  if (!mimeType || typeof mimeType !== 'string') {
    return {
      valid: false,
      error: 'MIME type is required',
    }
  }

  // Normalize MIME type (lowercase, trim)
  const normalizedType = mimeType.toLowerCase().trim()

  // Check against whitelist
  const isAllowed = allowedTypes.some(
    allowed => allowed.toLowerCase() === normalizedType
  )

  if (!isAllowed) {
    return {
      valid: false,
      error: `File type '${mimeType}' is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    }
  }

  return { valid: true }
}

// ============================================================================
// FILE EXTENSION VALIDATION
// ============================================================================

/**
 * Validates file extension against whitelist
 *
 * @param fileName - File name with extension
 * @param allowedExtensions - Array of allowed extensions (without dots)
 * @returns Validation result
 */
export function validateFileExtension(
  fileName: string,
  allowedExtensions: string[]
): { valid: boolean; error?: string } {
  if (!fileName || typeof fileName !== 'string') {
    return {
      valid: false,
      error: 'Filename is required',
    }
  }

  // Get extension (everything after last dot)
  const ext = path.extname(fileName).toLowerCase().slice(1) // Remove leading dot

  if (!ext) {
    return {
      valid: false,
      error: 'File must have an extension',
    }
  }

  // Check against whitelist
  const isAllowed = allowedExtensions.some(
    allowed => allowed.toLowerCase() === ext
  )

  if (!isAllowed) {
    return {
      valid: false,
      error: `File extension '.${ext}' is not allowed. Allowed extensions: ${allowedExtensions.map(e => `.${e}`).join(', ')}`,
    }
  }

  return { valid: true }
}

// ============================================================================
// MAGIC BYTE VALIDATION
// ============================================================================

/**
 * Validates file content matches expected type using magic bytes
 *
 * Magic bytes (file signatures) are the first few bytes of a file
 * that identify its format, regardless of extension or MIME type
 *
 * This prevents attacks where a malicious file is renamed with a safe extension
 *
 * @param buffer - File content as Buffer
 * @param fileName - File name (to determine expected type)
 * @returns Validation result with detected type
 */
export function validateMagicBytes(
  buffer: Buffer,
  fileName: string
): { valid: boolean; error?: string; detectedType?: string } {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: 'File content is required for validation',
    }
  }

  const ext = path.extname(fileName).toLowerCase().slice(1)

  // Check for Excel formats that have magic bytes
  if (ext === 'xlsx' || ext === 'xlsm') {
    // XLSX files are ZIP archives starting with PK
    if (!matchesSignature(buffer, FILE_SIGNATURES.XLSX)) {
      return {
        valid: false,
        error: 'File appears to be corrupted or not a valid Excel file',
        detectedType: 'unknown',
      }
    }
  } else if (ext === 'xls') {
    // XLS files use OLE2 format
    if (!matchesSignature(buffer, FILE_SIGNATURES.XLS)) {
      return {
        valid: false,
        error: 'File appears to be corrupted or not a valid Excel 97-2003 file',
        detectedType: 'unknown',
      }
    }
  }
  // CSV, JSON, TXT are text files - validate they contain valid UTF-8 text
  else if (ext === 'csv' || ext === 'json' || ext === 'txt') {
    const textValidation = validateTextFile(buffer)
    if (!textValidation.valid) {
      return textValidation
    }
  }

  return { valid: true }
}

/**
 * Checks if buffer starts with expected byte signature
 */
function matchesSignature(buffer: Buffer, signature: readonly number[]): boolean {
  if (buffer.length < signature.length) {
    return false
  }

  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false
    }
  }

  return true
}

/**
 * Validates that a file contains valid UTF-8 text
 * This prevents binary executable files from being uploaded as CSV/JSON/TXT
 */
function validateTextFile(
  buffer: Buffer
): { valid: boolean; error?: string; detectedType?: string } {
  try {
    // Check first 1KB for binary content
    const sampleSize = Math.min(1024, buffer.length)
    const sample = buffer.slice(0, sampleSize)

    // Count non-text bytes (control chars except whitespace)
    let nonTextBytes = 0
    for (let i = 0; i < sample.length; i++) {
      const byte = sample[i]
      // Allow: printable ASCII (32-126), tabs (9), newlines (10, 13)
      if (
        byte < 9 ||
        (byte > 13 && byte < 32) ||
        byte === 127
      ) {
        nonTextBytes++
      }
    }

    // If more than 10% of bytes are non-text, likely binary file
    const nonTextRatio = nonTextBytes / sample.length
    if (nonTextRatio > 0.1) {
      return {
        valid: false,
        error: 'File appears to contain binary data, not text',
        detectedType: 'binary',
      }
    }

    // Try to decode as UTF-8
    const text = buffer.toString('utf-8')

    // Check for replacement characters (indicates invalid UTF-8)
    if (text.includes('\uFFFD')) {
      return {
        valid: false,
        error: 'File contains invalid UTF-8 sequences',
        detectedType: 'invalid-encoding',
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: 'Failed to validate file encoding',
      detectedType: 'unknown',
    }
  }
}

// ============================================================================
// DOUBLE EXTENSION DETECTION
// ============================================================================

/**
 * Checks for dangerous double extensions
 *
 * Examples of attacks:
 * - file.csv.exe (appears as CSV but is executable)
 * - file.xlsx.bat (appears as Excel but is batch script)
 * - file.pdf.js (appears as PDF but is JavaScript)
 *
 * @param fileName - File name to check
 * @returns Validation result
 */
export function checkDangerousDoubleExtension(
  fileName: string
): { valid: boolean; error?: string } {
  if (!fileName || typeof fileName !== 'string') {
    return { valid: true } // Skip check if no filename
  }

  const parts = fileName.split('.')

  // If only one part (no extension) or two parts (name + extension), it's safe
  if (parts.length <= 2) {
    return { valid: true }
  }

  // Check all parts except the first (filename) for dangerous extensions
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].toLowerCase()
    if (DANGEROUS_EXTENSIONS.includes(part)) {
      return {
        valid: false,
        error: `Dangerous file extension detected: .${part}`,
      }
    }
  }

  return { valid: true }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Gets appropriate file size limit for a MIME type
 *
 * @param mimeType - MIME type
 * @returns Maximum file size in bytes
 */
export function getFileSizeLimit(mimeType: string): number {
  const normalized = mimeType.toLowerCase()

  if (ALLOWED_MIME_TYPES.CSV.some(t => t.toLowerCase() === normalized)) {
    return FILE_SIZE_LIMITS.DATA_FILE
  }
  if (ALLOWED_MIME_TYPES.EXCEL.some(t => t.toLowerCase() === normalized)) {
    return FILE_SIZE_LIMITS.DATA_FILE
  }
  if (ALLOWED_MIME_TYPES.JSON.some(t => t.toLowerCase() === normalized)) {
    return FILE_SIZE_LIMITS.DATA_FILE
  }

  return DEFAULT_MAX_FILE_SIZE
}

/**
 * Formats bytes to human-readable size
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
