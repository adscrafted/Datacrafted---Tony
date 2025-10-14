/**
 * Project Data API Routes
 *
 * Handles storage and retrieval of project data with compression and validation.
 *
 * Security Features:
 * - Firebase authentication required (withAuth middleware)
 * - Authorization checks (user must own project)
 * - Rate limiting to prevent abuse
 * - Data size validation (max 50MB uncompressed)
 * - Input validation and sanitization
 *
 * Performance Features:
 * - Gzip compression for efficient storage
 * - Sample data caching for quick previews
 * - Streaming support for large datasets
 * - Database indexing for fast retrieval
 *
 * @example Upload data
 * ```typescript
 * POST /api/projects/[id]/data
 * Authorization: Bearer <token>
 * Content-Type: application/json
 *
 * {
 *   "data": [{ "id": 1, "name": "Test" }],
 *   "metadata": {
 *     "fileName": "data.csv",
 *     "fileSize": 1024,
 *     "mimeType": "text/csv"
 *   }
 * }
 * ```
 *
 * @example Retrieve data
 * ```typescript
 * GET /api/projects/[id]/data?version=1&sampleOnly=true
 * Authorization: Bearer <token>
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'
import { compressData, decompressData, formatBytes } from '@/lib/utils/compression'
import {
  validateData,
  calculateDataQualityMetrics,
  createSampleData,
  calculateDataHash,
  type DataRow
} from '@/lib/utils/data-validation'

// ============================================================================
// Configuration Constants
// ============================================================================

const MAX_DATA_SIZE = 50 * 1024 * 1024 // 50MB uncompressed
const MAX_ROWS = 1_000_000 // 1 million rows
const MAX_COLUMNS = 1000
const SAMPLE_SIZE = 100
const COMPRESSION_LEVEL = 6 // Balanced compression (0-9)

// ============================================================================
// Type Definitions
// ============================================================================

interface ProjectDataUploadRequest {
  data: DataRow[]
  analysis?: any // AI analysis results (AnalysisResult | EnhancedAnalysisResult)
  chartCustomizations?: Record<string, any> // User chart edits
  metadata: {
    fileName: string
    fileSize: number
    mimeType: string
  }
  version?: number
}

interface ProjectDataResponse {
  id: string
  projectId: string
  version: number
  metadata: {
    originalFileName: string
    rowCount: number
    columnCount: number
    columnNames: string[]
    columnTypes: Record<string, string>
    dataQualityScore: number
  }
  createdAt: string
  updatedAt: string
}

interface ProjectDataRetrievalResponse {
  id: string
  projectId: string
  version: number
  data: DataRow[]
  analysis?: any // AI analysis results
  chartCustomizations?: Record<string, any> // User chart edits
  hasAnalysis: boolean
  metadata: {
    originalFileName: string
    originalFileSize: number
    rowCount: number
    columnCount: number
    columnNames: string[]
    columnTypes: Record<string, string>
    dataQualityScore: number | null
    compressionRatio: number
  }
  createdAt: string
  updatedAt: string
  isSample?: boolean
}

// ============================================================================
// GET Handler - Retrieve Project Data
// ============================================================================

const getHandler = withAuth(async (request, authUser, context) => {
  const startTime = Date.now()

  try {
    const { id: projectId } = await context!.params
    const { searchParams } = new URL(request.url)
    const version = parseInt(searchParams.get('version') || '0')
    const sampleOnly = searchParams.get('sampleOnly') === 'true'

    console.log('[API PROJECT DATA] GET request:', {
      projectId,
      version,
      sampleOnly,
      userId: authUser.uid
    })

    // ========================================================================
    // Step 1: Authorization - Verify user owns this project
    // ========================================================================

    // Get database user
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      console.log('[API PROJECT DATA] User not found in database')
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify project ownership
    const project = await db.projects.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      console.log('[API PROJECT DATA] Project not found:', projectId)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (project.userId !== dbUser.id) {
      console.log('[API PROJECT DATA] Authorization failed: User does not own project')
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this project' },
        { status: 403 }
      )
    }

    // ========================================================================
    // Step 2: Query project data
    // ========================================================================

    const whereClause: {
      projectId: string
      isActive: boolean
      version?: number
    } = {
      projectId,
      isActive: true
    }

    // If version specified, get that version; otherwise get latest
    if (version > 0) {
      whereClause.version = version
    }

    const projectData = version > 0
      ? await db.projectData.findFirst({
          where: whereClause,
          orderBy: { createdAt: 'desc' }
        })
      : await db.projectData.findFirst({
          where: whereClause,
          orderBy: { version: 'desc' }
        })

    if (!projectData) {
      console.log('[API PROJECT DATA] No data found for project')
      return NextResponse.json(
        { error: 'No data found for this project' },
        { status: 404 }
      )
    }

    // ========================================================================
    // Step 3: Return sample or full data
    // ========================================================================

    let data: DataRow[]
    let isSample = false

    if (sampleOnly && projectData.sampleData) {
      // Return cached sample data
      data = JSON.parse(projectData.sampleData)
      isSample = true
      console.log('[API PROJECT DATA] Returning sample data:', data.length, 'rows')
    } else {
      // Decompress and return full data
      console.log('[API PROJECT DATA] Decompressing full data...')
      const decompressStartTime = Date.now()

      // Ensure compressedData is a Buffer (Prisma Bytes type may not always be Buffer)
      const compressedBuffer = Buffer.isBuffer(projectData.compressedData)
        ? projectData.compressedData
        : Buffer.from(projectData.compressedData)

      const decompressed = await decompressData<DataRow[]>(compressedBuffer)
      data = decompressed.data

      const decompressTime = Date.now() - decompressStartTime
      console.log('[API PROJECT DATA] Decompressed in', decompressTime, 'ms')
    }

    const response: ProjectDataRetrievalResponse = {
      id: projectData.id,
      projectId: projectData.projectId,
      version: projectData.version,
      data,
      analysis: projectData.analysisData ? JSON.parse(projectData.analysisData) : undefined,
      chartCustomizations: projectData.chartCustomizations ? JSON.parse(projectData.chartCustomizations) : undefined,
      hasAnalysis: projectData.hasAnalysis,
      metadata: {
        originalFileName: projectData.originalFileName,
        originalFileSize: projectData.originalFileSize,
        rowCount: projectData.rowCount,
        columnCount: projectData.columnCount,
        columnNames: JSON.parse(projectData.columnNames),
        columnTypes: JSON.parse(projectData.columnTypes),
        dataQualityScore: projectData.dataQualityScore,
        compressionRatio: projectData.uncompressedSize / projectData.compressedData.length
      },
      createdAt: projectData.createdAt.toISOString(),
      updatedAt: projectData.updatedAt.toISOString(),
      isSample
    }

    const totalTime = Date.now() - startTime
    console.log('[API PROJECT DATA] GET completed in', totalTime, 'ms')

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API PROJECT DATA] Error retrieving data:', error)
    return NextResponse.json(
      {
        error: 'Failed to retrieve project data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

// Apply rate limiting (30 requests per minute)
export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)

// ============================================================================
// POST Handler - Upload Project Data
// ============================================================================

const postHandler = withAuth(async (request, authUser, context) => {
  const startTime = Date.now()

  try {
    const { id: projectId } = await context!.params

    console.log('[API PROJECT DATA] POST request:', {
      projectId,
      userId: authUser.uid
    })

    // ========================================================================
    // Step 1: Parse and validate request body
    // ========================================================================

    let body: ProjectDataUploadRequest
    try {
      body = await request.json()
    } catch (error) {
      console.error('[API PROJECT DATA] Invalid JSON in request body')
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { data, analysis, chartCustomizations, metadata, version } = body

    // Validate required fields
    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { error: 'Invalid data: must be an array of objects' },
        { status: 400 }
      )
    }

    // Validate analysis if provided
    if (analysis && typeof analysis !== 'object') {
      return NextResponse.json(
        { error: 'Invalid analysis: must be an object' },
        { status: 400 }
      )
    }

    if (!metadata || !metadata.fileName) {
      return NextResponse.json(
        { error: 'Invalid metadata: fileName is required' },
        { status: 400 }
      )
    }

    // ========================================================================
    // Step 2: Authorization - Verify user owns this project
    // ========================================================================

    // Get database user
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      console.log('[API PROJECT DATA] User not found in database')
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify project ownership
    const project = await db.projects.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      console.log('[API PROJECT DATA] Project not found:', projectId)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (project.userId !== dbUser.id) {
      console.log('[API PROJECT DATA] Authorization failed: User does not own project')
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this project' },
        { status: 403 }
      )
    }

    // ========================================================================
    // Step 3: Validate data
    // ========================================================================

    console.log('[API PROJECT DATA] Validating data...')
    const validationResult = validateData(data, MAX_ROWS, MAX_COLUMNS)

    if (!validationResult.valid) {
      console.error('[API PROJECT DATA] Validation failed:', validationResult.errors)
      return NextResponse.json(
        {
          error: 'Data validation failed',
          details: validationResult.errors
        },
        { status: 400 }
      )
    }

    if (!validationResult.metrics) {
      return NextResponse.json(
        { error: 'Failed to calculate data metrics' },
        { status: 500 }
      )
    }

    const metrics = validationResult.metrics

    // Check data size
    const jsonSize = JSON.stringify(data).length
    if (jsonSize > MAX_DATA_SIZE) {
      return NextResponse.json(
        {
          error: 'Data size exceeds maximum allowed size',
          details: `Data size: ${formatBytes(jsonSize)}, Maximum: ${formatBytes(MAX_DATA_SIZE)}`
        },
        { status: 413 } // Payload Too Large
      )
    }

    console.log('[API PROJECT DATA] Validation passed:', {
      rows: metrics.rowCount,
      columns: metrics.columnCount,
      qualityScore: metrics.dataQualityScore.toFixed(1),
      size: formatBytes(jsonSize)
    })

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      console.warn('[API PROJECT DATA] Validation warnings:', validationResult.warnings)
    }

    // ========================================================================
    // Step 4: Compress data
    // ========================================================================

    console.log('[API PROJECT DATA] Compressing data...')
    const compressionStartTime = Date.now()

    const compressed = await compressData(data, COMPRESSION_LEVEL)

    const compressionTime = Date.now() - compressionStartTime
    console.log('[API PROJECT DATA] Compressed in', compressionTime, 'ms:', {
      original: formatBytes(compressed.originalSize),
      compressed: formatBytes(compressed.compressedSize),
      ratio: `${compressed.compressionRatio.toFixed(2)}x`
    })

    // ========================================================================
    // Step 5: Create sample data
    // ========================================================================

    const sampleData = createSampleData(data, SAMPLE_SIZE)
    const sampleDataJson = JSON.stringify(sampleData)

    // ========================================================================
    // Step 6: Calculate data hash for deduplication
    // ========================================================================

    const dataHash = calculateDataHash(data)

    // ========================================================================
    // Step 7: Determine version number
    // ========================================================================

    let versionNumber = version || 1

    if (!version) {
      // Auto-increment version
      const latestData = await db.projectData.findFirst({
        where: { projectId, isActive: true },
        orderBy: { version: 'desc' }
      })

      if (latestData) {
        versionNumber = latestData.version + 1
      }
    }

    // ========================================================================
    // Step 8: Save to database
    // ========================================================================

    console.log('[API PROJECT DATA] Saving to database...')
    const dbStartTime = Date.now()

    const projectDataRecord = await db.projectData.create({
      data: {
        projectId,
        version: versionNumber,
        originalFileName: metadata.fileName,
        originalFileSize: metadata.fileSize || jsonSize,
        mimeType: metadata.mimeType || 'application/json',
        fileHash: dataHash,
        compressedData: compressed.data,
        compressionAlgorithm: compressed.algorithm,
        uncompressedSize: compressed.originalSize,
        rowCount: metrics.rowCount,
        columnCount: metrics.columnCount,
        columnNames: JSON.stringify(metrics.columnNames),
        columnTypes: JSON.stringify(metrics.columnTypes),
        sampleData: sampleDataJson,
        nullCount: metrics.nullCount,
        duplicateRowCount: metrics.duplicateRowCount,
        dataQualityScore: metrics.dataQualityScore,
        processingTimeMs: Date.now() - startTime,
        status: 'active',
        isActive: true,
        // Analysis storage
        analysisData: analysis ? JSON.stringify(analysis) : null,
        hasAnalysis: !!analysis,
        analysisVersion: analysis ? 1 : 1,
        analysisCreatedAt: analysis ? new Date() : null,
        chartCustomizations: chartCustomizations ? JSON.stringify(chartCustomizations) : null
      }
    })

    const dbTime = Date.now() - dbStartTime
    console.log('[API PROJECT DATA] Saved to database in', dbTime, 'ms')

    // ========================================================================
    // Step 9: Update project timestamp
    // ========================================================================

    await db.projects.update({
      where: { id: projectId },
      data: { updatedAt: new Date() }
    })

    // ========================================================================
    // Step 10: Return response
    // ========================================================================

    const response: ProjectDataResponse = {
      id: projectDataRecord.id,
      projectId: projectDataRecord.projectId,
      version: projectDataRecord.version,
      metadata: {
        originalFileName: projectDataRecord.originalFileName,
        rowCount: projectDataRecord.rowCount,
        columnCount: projectDataRecord.columnCount,
        columnNames: metrics.columnNames,
        columnTypes: metrics.columnTypes,
        dataQualityScore: projectDataRecord.dataQualityScore || 0
      },
      createdAt: projectDataRecord.createdAt.toISOString(),
      updatedAt: projectDataRecord.updatedAt.toISOString()
    }

    const totalTime = Date.now() - startTime
    console.log('[API PROJECT DATA] POST completed in', totalTime, 'ms')

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('[API PROJECT DATA] Error uploading data:', error)
    return NextResponse.json(
      {
        error: 'Failed to upload project data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

// Apply rate limiting (10 requests per hour for uploads - expensive operation)
export const POST = withRateLimit(RATE_LIMITS.ANALYSIS, postHandler)

// ============================================================================
// DELETE Handler - Delete Project Data Version (Soft Delete)
// ============================================================================

const deleteHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params
    const { searchParams } = new URL(request.url)
    const version = parseInt(searchParams.get('version') || '0')

    if (!version || version <= 0) {
      return NextResponse.json(
        { error: 'Version parameter is required' },
        { status: 400 }
      )
    }

    console.log('[API PROJECT DATA] DELETE request:', {
      projectId,
      version,
      userId: authUser.uid
    })

    // Authorization check
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const project = await db.projects.findUnique({
      where: { id: projectId }
    })

    if (!project || project.userId !== dbUser.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Soft delete (mark as inactive)
    const updated = await db.projectData.updateMany({
      where: {
        projectId,
        version,
        isActive: true
      },
      data: {
        isActive: false,
        status: 'deleted',
        updatedAt: new Date()
      }
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { error: 'Data version not found or already deleted' },
        { status: 404 }
      )
    }

    console.log('[API PROJECT DATA] Soft deleted version', version)

    return NextResponse.json({
      success: true,
      message: `Version ${version} deleted successfully`
    })
  } catch (error) {
    console.error('[API PROJECT DATA] Error deleting data:', error)
    return NextResponse.json(
      { error: 'Failed to delete project data' },
      { status: 500 }
    )
  }
})

export const DELETE = withRateLimit(RATE_LIMITS.SESSION, deleteHandler)
