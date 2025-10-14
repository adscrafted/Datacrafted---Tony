/**
 * Data Compression Utilities
 *
 * Provides utilities for compressing and decompressing data using gzip.
 * Used primarily for storing large datasets efficiently in the database.
 *
 * Features:
 * - Gzip compression/decompression
 * - Type-safe data handling
 * - Size calculation and metrics
 * - Error handling with detailed messages
 *
 * @example Basic usage
 * ```typescript
 * import { compressData, decompressData } from '@/lib/utils/compression'
 *
 * const data = [{ id: 1, name: 'Test' }]
 * const compressed = await compressData(data)
 * const decompressed = await decompressData<typeof data>(compressed)
 * ```
 */

import { gzip, gunzip } from 'zlib'
import { promisify } from 'util'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * Compression result with metadata
 */
export interface CompressionResult {
  data: Buffer
  originalSize: number
  compressedSize: number
  compressionRatio: number
  algorithm: 'gzip'
}

/**
 * Decompression result with metadata
 */
export interface DecompressionResult<T = unknown> {
  data: T
  originalSize: number
  decompressedSize: number
}

/**
 * Compression error with additional context
 */
export class CompressionError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'CompressionError'
  }
}

/**
 * Compress data using gzip
 *
 * @param data - Data to compress (will be JSON stringified)
 * @param level - Compression level (0-9, default 6)
 * @returns Compression result with metadata
 *
 * @example
 * ```typescript
 * const data = [{ id: 1, value: 100 }, { id: 2, value: 200 }]
 * const result = await compressData(data, 9) // Maximum compression
 * console.log(`Compressed ${result.originalSize} to ${result.compressedSize} bytes`)
 * console.log(`Compression ratio: ${result.compressionRatio}x`)
 * ```
 */
export async function compressData<T = unknown>(
  data: T,
  level: number = 6
): Promise<CompressionResult> {
  try {
    // Convert data to JSON string
    const jsonString = JSON.stringify(data)
    const originalSize = Buffer.byteLength(jsonString, 'utf8')

    // Validate data size (prevent compression of extremely large datasets)
    const MAX_SIZE = 100 * 1024 * 1024 // 100MB
    if (originalSize > MAX_SIZE) {
      throw new CompressionError(
        `Data size (${(originalSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${MAX_SIZE / 1024 / 1024}MB)`,
        undefined,
        { originalSize, maxSize: MAX_SIZE }
      )
    }

    // Compress using gzip
    const compressed = await gzipAsync(Buffer.from(jsonString, 'utf8'), {
      level: Math.max(0, Math.min(9, level)) // Clamp level between 0-9
    })

    const compressedSize = compressed.length
    const compressionRatio = originalSize / compressedSize

    return {
      data: compressed,
      originalSize,
      compressedSize,
      compressionRatio,
      algorithm: 'gzip'
    }
  } catch (error) {
    if (error instanceof CompressionError) {
      throw error
    }

    throw new CompressionError(
      'Failed to compress data',
      error as Error,
      { dataType: typeof data }
    )
  }
}

/**
 * Decompress gzip data
 *
 * @param compressed - Compressed data buffer
 * @returns Decompressed data with metadata
 *
 * @example
 * ```typescript
 * const compressed = await compressData(myData)
 * const result = await decompressData<MyDataType>(compressed.data)
 * console.log('Decompressed data:', result.data)
 * ```
 */
export async function decompressData<T = unknown>(
  compressed: Buffer
): Promise<DecompressionResult<T>> {
  try {
    // Validate input
    if (!Buffer.isBuffer(compressed)) {
      throw new CompressionError(
        'Invalid compressed data: expected Buffer',
        undefined,
        { receivedType: typeof compressed }
      )
    }

    if (compressed.length === 0) {
      throw new CompressionError('Cannot decompress empty buffer')
    }

    const originalSize = compressed.length

    // Decompress using gunzip
    const decompressed = await gunzipAsync(compressed)
    const decompressedSize = decompressed.length

    // Parse JSON
    const jsonString = decompressed.toString('utf8')
    const data = JSON.parse(jsonString) as T

    return {
      data,
      originalSize,
      decompressedSize
    }
  } catch (error) {
    if (error instanceof CompressionError) {
      throw error
    }

    // Provide more context for JSON parse errors
    if (error instanceof SyntaxError) {
      throw new CompressionError(
        'Failed to parse decompressed data as JSON',
        error,
        { bufferSize: compressed.length }
      )
    }

    throw new CompressionError(
      'Failed to decompress data',
      error as Error,
      { bufferSize: compressed.length }
    )
  }
}

/**
 * Calculate compression ratio without actually compressing
 * Useful for estimating if compression would be beneficial
 *
 * @param data - Data to estimate
 * @returns Estimated compression ratio
 */
export function estimateCompressionRatio<T = unknown>(data: T): number {
  try {
    const jsonString = JSON.stringify(data)
    const size = Buffer.byteLength(jsonString, 'utf8')

    // Simple heuristic: estimate 3:1 compression for typical JSON data
    // Actual compression ratio depends on data patterns
    return 3.0
  } catch {
    return 1.0 // No compression if estimation fails
  }
}

/**
 * Check if data should be compressed based on size
 * Small data may not benefit from compression overhead
 *
 * @param data - Data to check
 * @param minSizeBytes - Minimum size for compression (default 1KB)
 * @returns True if compression is recommended
 */
export function shouldCompress<T = unknown>(
  data: T,
  minSizeBytes: number = 1024
): boolean {
  try {
    const jsonString = JSON.stringify(data)
    const size = Buffer.byteLength(jsonString, 'utf8')
    return size >= minSizeBytes
  } catch {
    return false
  }
}

/**
 * Get size of data in bytes
 *
 * @param data - Data to measure
 * @returns Size in bytes
 */
export function getDataSize<T = unknown>(data: T): number {
  try {
    const jsonString = JSON.stringify(data)
    return Buffer.byteLength(jsonString, 'utf8')
  } catch {
    return 0
  }
}

/**
 * Format bytes to human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
