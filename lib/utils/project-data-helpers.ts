/**
 * Project Data Storage Utilities
 *
 * Helpers for compressing, storing, and retrieving project data
 * in Supabase PostgreSQL with optimal performance.
 */

import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';
import crypto from 'crypto';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectDataMetadata {
  originalFileName: string;
  originalFileSize: number;
  mimeType: string;
  rowCount: number;
  columnCount: number;
  columnNames: string[];
  columnTypes: Record<string, string>;
  nullCount: number;
  duplicateRowCount: number;
  dataQualityScore: number;
}

export interface CompressedProjectData {
  compressedData: Buffer;
  compressionAlgorithm: string;
  uncompressedSize: number;
  fileHash: string;
}

export interface ProjectDataPreview {
  id: string;
  rowCount: number;
  columnCount: number;
  columnNames: string[];
  columnTypes: Record<string, string>;
  sampleData: any[];
  dataQualityScore: number;
  createdAt: Date;
}

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

/**
 * Compress data using gzip
 * @param data - Raw data array to compress
 * @returns Compressed buffer and metadata
 */
export async function compressData(data: any[]): Promise<CompressedProjectData> {
  const jsonData = JSON.stringify(data);
  const compressedBuffer = await gzipAsync(Buffer.from(jsonData));

  return {
    compressedData: compressedBuffer,
    compressionAlgorithm: 'gzip',
    uncompressedSize: Buffer.byteLength(jsonData),
    fileHash: calculateHash(jsonData),
  };
}

/**
 * Decompress gzip data
 * @param compressedBuffer - Compressed data buffer
 * @returns Original data array
 */
export async function decompressData(compressedBuffer: Buffer): Promise<any[]> {
  const decompressedBuffer = await gunzipAsync(compressedBuffer);
  return JSON.parse(decompressedBuffer.toString());
}

/**
 * Calculate SHA-256 hash of data for deduplication
 */
export function calculateHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

/**
 * Extract comprehensive metadata from dataset
 */
export function extractMetadata(
  data: any[],
  fileName: string,
  fileSize: number,
  mimeType: string
): ProjectDataMetadata {
  const columnNames = Object.keys(data[0] || {});
  const columnTypes = inferColumnTypes(data, columnNames);
  const nullCount = calculateNullCount(data);
  const duplicateRowCount = findDuplicates(data);
  const dataQualityScore = calculateQualityScore(
    nullCount,
    duplicateRowCount,
    data.length,
    columnNames.length
  );

  return {
    originalFileName: fileName,
    originalFileSize: fileSize,
    mimeType,
    rowCount: data.length,
    columnCount: columnNames.length,
    columnNames,
    columnTypes,
    nullCount,
    duplicateRowCount,
    dataQualityScore,
  };
}

/**
 * Infer column data types from sample values
 */
export function inferColumnTypes(
  data: any[],
  columnNames: string[]
): Record<string, string> {
  const types: Record<string, string> = {};
  const sampleSize = Math.min(100, data.length); // Check first 100 rows

  for (const col of columnNames) {
    const values = data
      .slice(0, sampleSize)
      .map(row => row[col])
      .filter(v => v !== null && v !== '' && v !== undefined);

    if (values.length === 0) {
      types[col] = 'unknown';
      continue;
    }

    // Check for boolean
    if (values.every(v => v === true || v === false || v === 'true' || v === 'false')) {
      types[col] = 'boolean';
      continue;
    }

    // Check for number
    if (values.every(v => !isNaN(Number(v)))) {
      const hasDecimals = values.some(v => String(v).includes('.'));
      types[col] = hasDecimals ? 'float' : 'integer';
      continue;
    }

    // Check for date
    if (values.every(v => !isNaN(Date.parse(String(v))))) {
      types[col] = 'date';
      continue;
    }

    // Default to string
    types[col] = 'string';
  }

  return types;
}

// ============================================================================
// DATA QUALITY METRICS
// ============================================================================

/**
 * Count null or empty values across dataset
 */
export function calculateNullCount(data: any[]): number {
  return data.reduce((count, row) => {
    return count + Object.values(row).filter(v =>
      v === null || v === '' || v === undefined
    ).length;
  }, 0);
}

/**
 * Count duplicate rows in dataset
 */
export function findDuplicates(data: any[]): number {
  const seen = new Set<string>();
  let duplicates = 0;

  for (const row of data) {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      duplicates++;
    } else {
      seen.add(key);
    }
  }

  return duplicates;
}

/**
 * Calculate overall data quality score (0-100)
 *
 * Formula:
 * - 50 points: Completeness (no nulls)
 * - 50 points: Uniqueness (no duplicates)
 */
export function calculateQualityScore(
  nullCount: number,
  duplicateRowCount: number,
  totalRows: number,
  totalColumns: number
): number {
  if (totalRows === 0 || totalColumns === 0) return 0;

  const totalCells = totalRows * totalColumns;
  const nullPenalty = (nullCount / totalCells) * 50;
  const duplicatePenalty = (duplicateRowCount / totalRows) * 50;

  return Math.max(0, Math.round(100 - nullPenalty - duplicatePenalty));
}

// ============================================================================
// SAMPLE DATA GENERATION
// ============================================================================

/**
 * Extract first N rows as sample data for preview
 */
export function extractSampleData(data: any[], sampleSize = 100): any[] {
  return data.slice(0, sampleSize);
}

// ============================================================================
// PRISMA INTEGRATION HELPERS
// ============================================================================

/**
 * Prepare complete data payload for Prisma insert
 */
export async function prepareProjectDataPayload(
  projectId: string,
  data: any[],
  fileName: string,
  fileSize: number,
  mimeType: string,
  version = 1
) {
  const startTime = Date.now();

  // Extract metadata
  const metadata = extractMetadata(data, fileName, fileSize, mimeType);

  // Compress data
  const compressed = await compressData(data);

  // Extract sample
  const sampleData = extractSampleData(data);

  return {
    projectId,
    version,
    originalFileName: metadata.originalFileName,
    originalFileSize: metadata.originalFileSize,
    mimeType: metadata.mimeType,
    fileHash: compressed.fileHash,
    compressedData: compressed.compressedData,
    compressionAlgorithm: compressed.compressionAlgorithm,
    uncompressedSize: compressed.uncompressedSize,
    rowCount: metadata.rowCount,
    columnCount: metadata.columnCount,
    columnNames: JSON.stringify(metadata.columnNames),
    columnTypes: JSON.stringify(metadata.columnTypes),
    sampleData: JSON.stringify(sampleData),
    nullCount: metadata.nullCount,
    duplicateRowCount: metadata.duplicateRowCount,
    dataQualityScore: metadata.dataQualityScore,
    processingTimeMs: Date.now() - startTime,
    status: 'active',
    isActive: true,
  };
}

/**
 * Parse stored project data from Prisma result
 */
export function parseProjectDataResult(result: any): ProjectDataPreview {
  return {
    id: result.id,
    rowCount: result.rowCount,
    columnCount: result.columnCount,
    columnNames: JSON.parse(result.columnNames),
    columnTypes: JSON.parse(result.columnTypes),
    sampleData: result.sampleData ? JSON.parse(result.sampleData) : [],
    dataQualityScore: result.dataQualityScore,
    createdAt: result.createdAt,
  };
}

// ============================================================================
// STORAGE ESTIMATION
// ============================================================================

/**
 * Estimate storage size before compression
 */
export function estimateStorageSize(data: any[]): {
  uncompressed: number;
  estimatedCompressed: number;
  compressionRatio: number;
} {
  const jsonData = JSON.stringify(data);
  const uncompressed = Buffer.byteLength(jsonData);

  // Typical gzip compression ratio for CSV/JSON: 15-30%
  const estimatedCompressed = Math.round(uncompressed * 0.22); // 22% average
  const compressionRatio = 0.22;

  return {
    uncompressed,
    estimatedCompressed,
    compressionRatio,
  };
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate data before storage
 */
export function validateData(data: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(data)) {
    errors.push('Data must be an array');
    return { valid: false, errors };
  }

  if (data.length === 0) {
    errors.push('Data array is empty');
    return { valid: false, errors };
  }

  if (data.length > 10000) {
    errors.push(`Row count ${data.length} exceeds maximum of 10,000`);
  }

  const firstRow = data[0];
  if (typeof firstRow !== 'object' || firstRow === null) {
    errors.push('Data rows must be objects');
    return { valid: false, errors };
  }

  const columnCount = Object.keys(firstRow).length;
  if (columnCount === 0) {
    errors.push('Data rows must have at least one column');
  }

  if (columnCount > 100) {
    errors.push(`Column count ${columnCount} exceeds recommended maximum of 100`);
  }

  // Check size estimate
  const { uncompressed } = estimateStorageSize(data);
  const maxSize = 10 * 1024 * 1024; // 10MB uncompressed
  if (uncompressed > maxSize) {
    errors.push(
      `Data size ${formatBytes(uncompressed)} exceeds maximum of ${formatBytes(maxSize)}`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const ProjectDataHelpers = {
  // Compression
  compressData,
  decompressData,
  calculateHash,

  // Metadata
  extractMetadata,
  inferColumnTypes,

  // Quality
  calculateNullCount,
  findDuplicates,
  calculateQualityScore,

  // Sample
  extractSampleData,

  // Prisma
  prepareProjectDataPayload,
  parseProjectDataResult,

  // Storage
  estimateStorageSize,
  formatBytes,

  // Validation
  validateData,
};

export default ProjectDataHelpers;
