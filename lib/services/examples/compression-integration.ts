/**
 * Practical examples of integrating DataCompressionService
 * with existing API routes and database operations
 */

import { DataCompressionService, CompressionAlgorithm } from '../data-compression';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient() as any; // Example file - dataSession model doesn't exist in schema

// ============================================================================
// Example 1: CSV Upload with Compression
// ============================================================================

interface CSVUploadResult {
  sessionId: string;
  rowCount: number;
  originalSize: number;
  compressedSize: number;
  spaceSaved: string;
}

/**
 * Upload and compress CSV data
 */
export async function uploadAndCompressCSV(
  userId: string,
  csvData: any[],
  fileName: string
): Promise<CSVUploadResult> {
  const compressionService = new DataCompressionService({
    algorithm: CompressionAlgorithm.GZIP,
    level: 9 // Maximum compression for storage
  });

  try {
    // Step 1: Validate data size
    const validation = compressionService.validateDataSize(csvData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.reason}`);
    }

    console.log('Validation passed:', {
      rows: csvData.length,
      uncompressedSize: `${(validation.size / 1024).toFixed(2)} KB`
    });

    // Step 2: Compress data
    const compressed = await compressionService.compress(csvData);

    console.log('Compression complete:', {
      originalSize: compressed.metadata.originalSize,
      compressedSize: compressed.metadata.compressedSize,
      ratio: compressed.metadata.compressionRatio,
      spaceSaved: `${((1 - compressed.metadata.compressionRatio) * 100).toFixed(2)}%`
    });

    // Step 3: Store in database
    const session = await prisma.dataSession.create({
      data: {
        userId,
        fileName,
        compressedData: compressed.buffer,
        originalSize: compressed.metadata.originalSize,
        compressedSize: compressed.metadata.compressedSize,
        compressionRatio: compressed.metadata.compressionRatio,
        algorithm: compressed.metadata.algorithm,
        rowCount: csvData.length
      }
    });

    return {
      sessionId: session.id,
      rowCount: csvData.length,
      originalSize: compressed.metadata.originalSize,
      compressedSize: compressed.metadata.compressedSize,
      spaceSaved: `${((1 - compressed.metadata.compressionRatio) * 100).toFixed(2)}%`
    };
  } catch (error) {
    console.error('Upload and compression failed:', error);
    throw error;
  }
}

// ============================================================================
// Example 2: Retrieve and Decompress Data
// ============================================================================

interface SessionData {
  data: any[];
  metadata: {
    fileName: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    rowCount: number;
    algorithm: string;
    createdAt: Date;
  };
}

/**
 * Retrieve and decompress session data
 */
export async function getSessionData(sessionId: string): Promise<SessionData> {
  try {
    // Step 1: Fetch from database
    const session = await prisma.dataSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Step 2: Create compression service with correct algorithm
    const compressionService = new DataCompressionService({
      algorithm: session.algorithm as CompressionAlgorithm
    });

    // Step 3: Decompress data
    const data = await compressionService.decompress(session.compressedData);

    console.log('Decompression complete:', {
      rows: data.length,
      decompressedSize: session.originalSize
    });

    return {
      data,
      metadata: {
        fileName: session.fileName,
        originalSize: session.originalSize,
        compressedSize: session.compressedSize,
        compressionRatio: session.compressionRatio,
        rowCount: session.rowCount,
        algorithm: session.algorithm,
        createdAt: session.createdAt
      }
    };
  } catch (error) {
    console.error('Decompression failed:', error);
    throw error;
  }
}

// ============================================================================
// Example 3: Batch Processing with Progress Tracking
// ============================================================================

interface BatchUploadProgress {
  total: number;
  completed: number;
  failed: number;
  currentFile: string;
}

/**
 * Upload multiple CSV files with compression and progress tracking
 */
export async function batchUploadCSVFiles(
  userId: string,
  files: Array<{ name: string; data: any[] }>,
  onProgress?: (progress: BatchUploadProgress) => void
): Promise<string[]> {
  const sessionIds: string[] = [];
  const compressionService = new DataCompressionService({
    algorithm: CompressionAlgorithm.GZIP,
    level: 6 // Balanced for batch processing
  });

  let completed = 0;
  let failed = 0;

  for (const file of files) {
    try {
      // Report progress
      if (onProgress) {
        onProgress({
          total: files.length,
          completed,
          failed,
          currentFile: file.name
        });
      }

      // Validate
      const validation = compressionService.validateDataSize(file.data);
      if (!validation.valid) {
        console.warn(`Skipping ${file.name}: ${validation.reason}`);
        failed++;
        continue;
      }

      // Compress
      const compressed = await compressionService.compress(file.data);

      // Store
      const session = await prisma.dataSession.create({
        data: {
          userId,
          fileName: file.name,
          compressedData: compressed.buffer,
          originalSize: compressed.metadata.originalSize,
          compressedSize: compressed.metadata.compressedSize,
          compressionRatio: compressed.metadata.compressionRatio,
          algorithm: compressed.metadata.algorithm,
          rowCount: file.data.length
        }
      });

      sessionIds.push(session.id);
      completed++;
    } catch (error) {
      console.error(`Failed to process ${file.name}:`, error);
      failed++;
    }
  }

  // Final progress report
  if (onProgress) {
    onProgress({
      total: files.length,
      completed,
      failed,
      currentFile: ''
    });
  }

  return sessionIds;
}

// ============================================================================
// Example 4: Data Export with Decompression
// ============================================================================

/**
 * Export session data as JSON
 */
export async function exportSessionAsJSON(sessionId: string): Promise<string> {
  const sessionData = await getSessionData(sessionId);
  return JSON.stringify(sessionData.data, null, 2);
}

/**
 * Export session data as CSV string
 */
export async function exportSessionAsCSV(sessionId: string): Promise<string> {
  const sessionData = await getSessionData(sessionId);

  if (sessionData.data.length === 0) {
    return '';
  }

  // Get headers from first row
  const headers = Object.keys(sessionData.data[0]);

  // Create CSV content
  const csvRows = [
    headers.join(','), // Header row
    ...sessionData.data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value ?? '');
        return stringValue.includes(',') || stringValue.includes('"')
          ? `"${stringValue.replace(/"/g, '""')}"`
          : stringValue;
      }).join(',')
    )
  ];

  return csvRows.join('\n');
}

// ============================================================================
// Example 5: Compression Analytics
// ============================================================================

interface CompressionStats {
  totalSessions: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  averageCompressionRatio: number;
  totalSpaceSaved: number;
  spaceSavedPercentage: number;
}

/**
 * Get compression statistics for a user
 */
export async function getUserCompressionStats(userId: string): Promise<CompressionStats> {
  const sessions = await prisma.dataSession.findMany({
    where: { userId },
    select: {
      originalSize: true,
      compressedSize: true,
      compressionRatio: true
    }
  });

  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      averageCompressionRatio: 0,
      totalSpaceSaved: 0,
      spaceSavedPercentage: 0
    };
  }

  const totalOriginalSize = sessions.reduce((sum: number, s: any) => sum + s.originalSize, 0);
  const totalCompressedSize = sessions.reduce((sum: number, s: any) => sum + s.compressedSize, 0);
  const averageCompressionRatio = sessions.reduce((sum: number, s: any) => sum + s.compressionRatio, 0) / sessions.length;
  const totalSpaceSaved = totalOriginalSize - totalCompressedSize;
  const spaceSavedPercentage = (totalSpaceSaved / totalOriginalSize) * 100;

  return {
    totalSessions: sessions.length,
    totalOriginalSize,
    totalCompressedSize,
    averageCompressionRatio,
    totalSpaceSaved,
    spaceSavedPercentage
  };
}

// ============================================================================
// Example 6: Smart Algorithm Selection
// ============================================================================

/**
 * Automatically select best compression algorithm based on data characteristics
 */
export async function compressWithAutoAlgorithm(
  data: any[],
  priority: 'speed' | 'size' = 'speed'
): Promise<{ buffer: Buffer; algorithm: CompressionAlgorithm; metadata: any }> {
  // Test with both algorithms on a sample
  const sampleSize = Math.min(100, data.length);
  const sample = data.slice(0, sampleSize);

  const gzipService = new DataCompressionService({
    algorithm: CompressionAlgorithm.GZIP,
    level: priority === 'speed' ? 6 : 9
  });

  const brotliService = new DataCompressionService({
    algorithm: CompressionAlgorithm.BROTLI,
    level: priority === 'speed' ? 4 : 11
  });

  // Test compression on sample
  const gzipSample = await gzipService.compress(sample);
  const brotliSample = await brotliService.compress(sample);

  // Select algorithm based on priority
  let selectedService: DataCompressionService;
  let selectedAlgorithm: CompressionAlgorithm;

  if (priority === 'speed') {
    // GZIP is generally faster
    selectedService = gzipService;
    selectedAlgorithm = CompressionAlgorithm.GZIP;
  } else {
    // Select algorithm with better compression ratio
    selectedService = gzipSample.metadata.compressionRatio < brotliSample.metadata.compressionRatio
      ? gzipService
      : brotliService;
    selectedAlgorithm = selectedService.getAlgorithm();
  }

  console.log('Algorithm selected:', {
    algorithm: selectedAlgorithm,
    gzipRatio: gzipSample.metadata.compressionRatio,
    brotliRatio: brotliSample.metadata.compressionRatio,
    priority
  });

  // Compress full data with selected algorithm
  const result = await selectedService.compress(data);

  return {
    buffer: result.buffer,
    algorithm: selectedAlgorithm,
    metadata: result.metadata
  };
}

// ============================================================================
// Example 7: Incremental Update with Compression
// ============================================================================

/**
 * Update existing session by appending new rows (decompress, modify, recompress)
 */
export async function appendRowsToSession(
  sessionId: string,
  newRows: any[]
): Promise<void> {
  try {
    // Step 1: Retrieve and decompress existing data
    const session = await prisma.dataSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const compressionService = new DataCompressionService({
      algorithm: session.algorithm as CompressionAlgorithm
    });

    const existingData = await compressionService.decompress(session.compressedData);

    // Step 2: Append new rows
    const updatedData = [...existingData, ...newRows];

    // Step 3: Validate new total size
    const validation = compressionService.validateDataSize(updatedData);
    if (!validation.valid) {
      throw new Error(`Cannot append rows: ${validation.reason}`);
    }

    // Step 4: Recompress
    const compressed = await compressionService.compress(updatedData);

    // Step 5: Update database
    await prisma.dataSession.update({
      where: { id: sessionId },
      data: {
        compressedData: compressed.buffer,
        originalSize: compressed.metadata.originalSize,
        compressedSize: compressed.metadata.compressedSize,
        compressionRatio: compressed.metadata.compressionRatio,
        rowCount: updatedData.length
      }
    });

    console.log('Session updated:', {
      previousRows: existingData.length,
      newRows: newRows.length,
      totalRows: updatedData.length
    });
  } catch (error) {
    console.error('Failed to append rows:', error);
    throw error;
  }
}

// ============================================================================
// Example 8: Compression Performance Monitoring
// ============================================================================

interface PerformanceMetrics {
  operation: 'compress' | 'decompress';
  duration: number;
  dataSize: number;
  throughput: number; // bytes per second
}

/**
 * Compress with performance monitoring
 */
export async function compressWithMetrics(data: any[]): Promise<{
  result: any;
  metrics: PerformanceMetrics;
}> {
  const compressionService = new DataCompressionService();
  const validation = compressionService.validateDataSize(data);

  const startTime = Date.now();
  const result = await compressionService.compress(data);
  const duration = Date.now() - startTime;

  const metrics: PerformanceMetrics = {
    operation: 'compress',
    duration,
    dataSize: validation.size,
    throughput: validation.size / (duration / 1000) // bytes per second
  };

  console.log('Compression metrics:', {
    duration: `${duration}ms`,
    throughput: `${(metrics.throughput / 1024 / 1024).toFixed(2)} MB/s`,
    compressionRatio: result.metadata.compressionRatio
  });

  return { result, metrics };
}

/**
 * Decompress with performance monitoring
 */
export async function decompressWithMetrics(
  buffer: Buffer,
  algorithm: CompressionAlgorithm
): Promise<{
  result: any[];
  metrics: PerformanceMetrics;
}> {
  const compressionService = new DataCompressionService({ algorithm });

  const startTime = Date.now();
  const result = await compressionService.decompress(buffer);
  const duration = Date.now() - startTime;

  const dataSize = Buffer.byteLength(JSON.stringify(result));

  const metrics: PerformanceMetrics = {
    operation: 'decompress',
    duration,
    dataSize,
    throughput: dataSize / (duration / 1000)
  };

  console.log('Decompression metrics:', {
    duration: `${duration}ms`,
    throughput: `${(metrics.throughput / 1024 / 1024).toFixed(2)} MB/s`,
    rows: result.length
  });

  return { result, metrics };
}
