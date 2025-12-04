import { promisify } from 'util';
import { gzip, gunzip, brotliCompress, brotliDecompress, constants } from 'zlib';

// Promisify zlib functions for async/await usage
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const brotliCompressAsync = promisify(brotliCompress);
const brotliDecompressAsync = promisify(brotliDecompress);

/**
 * Compression algorithms supported by the service
 */
export enum CompressionAlgorithm {
  GZIP = 'gzip',
  BROTLI = 'brotli'
}

/**
 * Configuration options for compression
 */
export interface CompressionOptions {
  algorithm?: CompressionAlgorithm;
  level?: number; // 1-9 for gzip, 0-11 for brotli
}

/**
 * Result of data size validation
 */
export interface ValidationResult {
  valid: boolean;
  size: number;
  reason?: string;
}

/**
 * Metadata about compression operation
 */
export interface CompressionMetadata {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: CompressionAlgorithm;
  timestamp: Date;
}

/**
 * Compressed data with metadata
 */
export interface CompressedData {
  buffer: Buffer;
  metadata: CompressionMetadata;
}

/**
 * Production-ready data compression service for efficient storage
 * of CSV/Excel data in PostgreSQL
 */
export class DataCompressionService {
  // Constants
  private static readonly MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024; // 200MB (for 100K rows)
  private static readonly MAX_ROWS = 100000; // 100K rows
  private static readonly MIN_COMPRESSION_RATIO = 0.7; // 70%
  private static readonly MAX_COMPRESSION_RATIO = 0.8; // 80%

  // Default compression settings
  private static readonly DEFAULT_GZIP_LEVEL = constants.Z_BEST_COMPRESSION; // Level 9
  private static readonly DEFAULT_BROTLI_LEVEL = constants.BROTLI_MAX_QUALITY; // Level 11

  private algorithm: CompressionAlgorithm;
  private compressionLevel: number;

  constructor(options: CompressionOptions = {}) {
    this.algorithm = options.algorithm || CompressionAlgorithm.GZIP;

    // Set compression level based on algorithm
    if (this.algorithm === CompressionAlgorithm.GZIP) {
      this.compressionLevel = options.level || DataCompressionService.DEFAULT_GZIP_LEVEL;
      // Validate gzip level (1-9)
      if (this.compressionLevel < 1 || this.compressionLevel > 9) {
        throw new Error('GZIP compression level must be between 1 and 9');
      }
    } else {
      this.compressionLevel = options.level || DataCompressionService.DEFAULT_BROTLI_LEVEL;
      // Validate brotli level (0-11)
      if (this.compressionLevel < 0 || this.compressionLevel > 11) {
        throw new Error('Brotli compression level must be between 0 and 11');
      }
    }
  }

  /**
   * Compress data array to Buffer using specified algorithm
   * @param data - Array of data objects to compress
   * @returns Compressed data with metadata
   * @throws Error if data is invalid or compression fails
   */
  async compress(data: any[]): Promise<CompressedData> {
    try {
      // Validate input
      if (!Array.isArray(data)) {
        throw new Error('Data must be an array');
      }

      // Validate data size
      const validation = this.validateDataSize(data);
      if (!validation.valid) {
        throw new Error(`Data validation failed: ${validation.reason}`);
      }

      // Convert data to JSON string
      const jsonString = JSON.stringify(data);
      const originalBuffer = Buffer.from(jsonString, 'utf-8');
      const originalSize = originalBuffer.length;

      // Compress based on algorithm
      let compressedBuffer: Buffer;

      if (this.algorithm === CompressionAlgorithm.GZIP) {
        compressedBuffer = await gzipAsync(originalBuffer, {
          level: this.compressionLevel
        });
      } else {
        compressedBuffer = await brotliCompressAsync(originalBuffer, {
          params: {
            [constants.BROTLI_PARAM_QUALITY]: this.compressionLevel
          }
        });
      }

      const compressedSize = compressedBuffer.length;
      const compressionRatio = this.getCompressionRatio(originalSize, compressedSize);

      // Log warning if compression ratio is outside expected range
      if (compressionRatio < DataCompressionService.MIN_COMPRESSION_RATIO) {
        console.warn(`Low compression ratio: ${(compressionRatio * 100).toFixed(2)}%. Expected 70-80%.`);
      }

      return {
        buffer: compressedBuffer,
        metadata: {
          originalSize,
          compressedSize,
          compressionRatio,
          algorithm: this.algorithm,
          timestamp: new Date()
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Compression failed: ${error.message}`);
      }
      throw new Error('Compression failed: Unknown error');
    }
  }

  /**
   * Decompress Buffer back to original data array
   * @param buffer - Compressed data buffer
   * @returns Decompressed data array
   * @throws Error if decompression fails or data is corrupted
   */
  async decompress(buffer: Buffer): Promise<any[]> {
    try {
      // Validate input
      if (!Buffer.isBuffer(buffer)) {
        throw new Error('Input must be a Buffer');
      }

      if (buffer.length === 0) {
        throw new Error('Buffer is empty');
      }

      // Decompress based on algorithm
      let decompressedBuffer: Buffer;

      if (this.algorithm === CompressionAlgorithm.GZIP) {
        decompressedBuffer = await gunzipAsync(buffer);
      } else {
        decompressedBuffer = await brotliDecompressAsync(buffer);
      }

      // Convert buffer to string and parse JSON
      const jsonString = decompressedBuffer.toString('utf-8');
      const data = JSON.parse(jsonString);

      // Validate decompressed data
      if (!Array.isArray(data)) {
        throw new Error('Decompressed data is not an array');
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        // Provide specific error messages for common issues
        if (error.message.includes('incorrect header check')) {
          throw new Error('Decompression failed: Data is corrupted or not compressed with the specified algorithm');
        }
        if (error.message.includes('Unexpected token')) {
          throw new Error('Decompression failed: Invalid JSON data');
        }
        throw new Error(`Decompression failed: ${error.message}`);
      }
      throw new Error('Decompression failed: Unknown error');
    }
  }

  /**
   * Calculate compression ratio
   * @param originalSize - Original data size in bytes
   * @param compressedSize - Compressed data size in bytes
   * @returns Compression ratio (0-1, where lower is better)
   */
  getCompressionRatio(originalSize: number, compressedSize: number): number {
    if (originalSize === 0) {
      throw new Error('Original size cannot be zero');
    }
    if (compressedSize < 0 || originalSize < 0) {
      throw new Error('Sizes must be non-negative');
    }
    return compressedSize / originalSize;
  }

  /**
   * Calculate space saved by compression
   * @param originalSize - Original data size in bytes
   * @param compressedSize - Compressed data size in bytes
   * @returns Percentage of space saved (0-100)
   */
  getSpaceSavings(originalSize: number, compressedSize: number): number {
    const ratio = this.getCompressionRatio(originalSize, compressedSize);
    return (1 - ratio) * 100;
  }

  /**
   * Validate data size against constraints
   * @param data - Data array to validate
   * @returns Validation result with size information
   */
  validateDataSize(data: any[]): ValidationResult {
    try {
      // Check if data is an array
      if (!Array.isArray(data)) {
        return {
          valid: false,
          size: 0,
          reason: 'Data must be an array'
        };
      }

      // Check row count
      if (data.length > DataCompressionService.MAX_ROWS) {
        return {
          valid: false,
          size: 0,
          reason: `Row count ${data.length} exceeds maximum of ${DataCompressionService.MAX_ROWS}`
        };
      }

      // Check empty data
      if (data.length === 0) {
        return {
          valid: true,
          size: 0
        };
      }

      // Calculate size
      const jsonString = JSON.stringify(data);
      const size = Buffer.byteLength(jsonString, 'utf-8');

      // Check size constraints
      if (size > DataCompressionService.MAX_UNCOMPRESSED_SIZE) {
        return {
          valid: false,
          size,
          reason: `Data size ${this.formatBytes(size)} exceeds maximum of ${this.formatBytes(DataCompressionService.MAX_UNCOMPRESSED_SIZE)}`
        };
      }

      return {
        valid: true,
        size
      };
    } catch (error) {
      return {
        valid: false,
        size: 0,
        reason: error instanceof Error ? error.message : 'Unknown validation error'
      };
    }
  }

  /**
   * Format bytes to human-readable string
   * @param bytes - Number of bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Estimate compressed size before compression
   * @param data - Data array to estimate
   * @returns Estimated compressed size in bytes
   */
  estimateCompressedSize(data: any[]): number {
    const validation = this.validateDataSize(data);
    if (!validation.valid) {
      throw new Error(`Cannot estimate size: ${validation.reason}`);
    }

    // Use average compression ratio for estimation
    const avgCompressionRatio = (DataCompressionService.MIN_COMPRESSION_RATIO + DataCompressionService.MAX_COMPRESSION_RATIO) / 2;
    return Math.floor(validation.size * avgCompressionRatio);
  }

  /**
   * Get current compression algorithm
   */
  getAlgorithm(): CompressionAlgorithm {
    return this.algorithm;
  }

  /**
   * Get current compression level
   */
  getCompressionLevel(): number {
    return this.compressionLevel;
  }

  /**
   * Get maximum allowed uncompressed size
   */
  static getMaxUncompressedSize(): number {
    return DataCompressionService.MAX_UNCOMPRESSED_SIZE;
  }

  /**
   * Get maximum allowed row count
   */
  static getMaxRows(): number {
    return DataCompressionService.MAX_ROWS;
  }
}

/**
 * Factory function to create a compression service with default settings
 */
export function createCompressionService(options?: CompressionOptions): DataCompressionService {
  return new DataCompressionService(options);
}

/**
 * Utility function to quickly compress data with default settings
 */
export async function compressData(data: any[], algorithm: CompressionAlgorithm = CompressionAlgorithm.GZIP): Promise<CompressedData> {
  const service = new DataCompressionService({ algorithm });
  return service.compress(data);
}

/**
 * Utility function to quickly decompress data with default settings
 */
export async function decompressData(buffer: Buffer, algorithm: CompressionAlgorithm = CompressionAlgorithm.GZIP): Promise<any[]> {
  const service = new DataCompressionService({ algorithm });
  return service.decompress(buffer);
}
