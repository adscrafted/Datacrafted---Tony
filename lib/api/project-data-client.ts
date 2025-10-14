/**
 * Project Data API Client
 *
 * Type-safe client for interacting with the Project Data API.
 * Handles authentication, error handling, and response parsing.
 *
 * @example Basic usage
 * ```typescript
 * import { projectDataClient } from '@/lib/api/project-data-client'
 *
 * // Upload data
 * const result = await projectDataClient.upload('project-123', myData, {
 *   fileName: 'data.csv',
 *   fileSize: 1024
 * })
 *
 * // Fetch data
 * const data = await projectDataClient.fetch('project-123')
 * ```
 */

import { auth } from '@/lib/config/firebase'

// ============================================================================
// Type Definitions
// ============================================================================

export interface DataRow {
  [key: string]: unknown
}

export interface UploadMetadata {
  fileName: string
  fileSize?: number
  mimeType?: string
}

export interface UploadOptions {
  version?: number
  metadata: UploadMetadata
}

export interface FetchOptions {
  version?: number
  sampleOnly?: boolean
}

export interface ProjectDataMetadata {
  originalFileName: string
  originalFileSize?: number
  rowCount: number
  columnCount: number
  columnNames: string[]
  columnTypes: Record<string, string>
  dataQualityScore: number | null
  compressionRatio?: number
}

export interface UploadResponse {
  id: string
  projectId: string
  version: number
  metadata: Omit<ProjectDataMetadata, 'compressionRatio' | 'originalFileSize'>
  createdAt: string
  updatedAt: string
}

export interface FetchResponse {
  id: string
  projectId: string
  version: number
  data: DataRow[]
  metadata: ProjectDataMetadata
  createdAt: string
  updatedAt: string
  isSample?: boolean
}

export interface DeleteResponse {
  success: boolean
  message: string
}

export interface ApiError {
  error: string
  details?: string | string[]
}

// ============================================================================
// API Client Error
// ============================================================================

export class ProjectDataApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: string | string[]
  ) {
    super(message)
    this.name = 'ProjectDataApiError'
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Firebase authentication token
 */
async function getAuthToken(): Promise<string> {
  const currentUser = auth.currentUser

  if (!currentUser) {
    throw new ProjectDataApiError('Not authenticated', 401)
  }

  try {
    return await currentUser.getIdToken()
  } catch (error) {
    throw new ProjectDataApiError(
      'Failed to get authentication token',
      401,
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

/**
 * Make authenticated API request
 */
async function makeRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  })

  // Handle rate limiting
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') || '60'
    const resetAt = response.headers.get('X-RateLimit-Reset')

    let message = `Rate limit exceeded. Try again in ${retryAfter} seconds.`
    if (resetAt) {
      const resetDate = new Date(parseInt(resetAt))
      message += ` (resets at ${resetDate.toLocaleTimeString()})`
    }

    throw new ProjectDataApiError(message, 429, message)
  }

  // Parse response
  const data = await response.json()

  // Handle error responses
  if (!response.ok) {
    const apiError = data as ApiError
    throw new ProjectDataApiError(
      apiError.error || 'Request failed',
      response.status,
      apiError.details
    )
  }

  return data as T
}

/**
 * Build query string from options
 */
function buildQueryString(params: Record<string, string | number | boolean>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value))
    }
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

// ============================================================================
// Project Data Client
// ============================================================================

export const projectDataClient = {
  /**
   * Upload project data
   *
   * @param projectId - Project ID
   * @param data - Array of data rows
   * @param options - Upload options including metadata
   * @returns Upload response with metadata
   *
   * @example
   * ```typescript
   * const result = await projectDataClient.upload(
   *   'project-123',
   *   [{ id: 1, name: 'Alice' }],
   *   {
   *     metadata: {
   *       fileName: 'data.csv',
   *       fileSize: 1024,
   *       mimeType: 'text/csv'
   *     },
   *     version: 1
   *   }
   * )
   * console.log(`Uploaded ${result.metadata.rowCount} rows`)
   * ```
   */
  async upload(
    projectId: string,
    data: DataRow[],
    options: UploadOptions
  ): Promise<UploadResponse> {
    if (!projectId) {
      throw new ProjectDataApiError('Project ID is required', 400)
    }

    if (!Array.isArray(data)) {
      throw new ProjectDataApiError('Data must be an array', 400)
    }

    if (!options.metadata?.fileName) {
      throw new ProjectDataApiError('File name is required in metadata', 400)
    }

    const url = `/api/projects/${projectId}/data`

    const body = {
      data,
      metadata: {
        fileName: options.metadata.fileName,
        fileSize: options.metadata.fileSize || JSON.stringify(data).length,
        mimeType: options.metadata.mimeType || 'application/json'
      },
      version: options.version
    }

    return makeRequest<UploadResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body)
    })
  },

  /**
   * Fetch project data
   *
   * @param projectId - Project ID
   * @param options - Fetch options (version, sampleOnly)
   * @returns Fetch response with data and metadata
   *
   * @example
   * ```typescript
   * // Fetch sample data (fast)
   * const sample = await projectDataClient.fetch('project-123', {
   *   sampleOnly: true
   * })
   *
   * // Fetch specific version
   * const v1 = await projectDataClient.fetch('project-123', {
   *   version: 1
   * })
   *
   * // Fetch latest full data
   * const latest = await projectDataClient.fetch('project-123')
   * ```
   */
  async fetch(
    projectId: string,
    options: FetchOptions = {}
  ): Promise<FetchResponse> {
    if (!projectId) {
      throw new ProjectDataApiError('Project ID is required', 400)
    }

    const queryString = buildQueryString({
      version: options.version || 0,
      sampleOnly: options.sampleOnly || false
    })

    const url = `/api/projects/${projectId}/data${queryString}`

    return makeRequest<FetchResponse>(url, {
      method: 'GET'
    })
  },

  /**
   * Delete project data version (soft delete)
   *
   * @param projectId - Project ID
   * @param version - Version number to delete
   * @returns Delete response
   *
   * @example
   * ```typescript
   * await projectDataClient.delete('project-123', 1)
   * console.log('Version 1 deleted')
   * ```
   */
  async delete(
    projectId: string,
    version: number
  ): Promise<DeleteResponse> {
    if (!projectId) {
      throw new ProjectDataApiError('Project ID is required', 400)
    }

    if (!version || version <= 0) {
      throw new ProjectDataApiError('Valid version number is required', 400)
    }

    const url = `/api/projects/${projectId}/data?version=${version}`

    return makeRequest<DeleteResponse>(url, {
      method: 'DELETE'
    })
  },

  /**
   * List all data versions for a project
   *
   * Note: This endpoint is not yet implemented in the API.
   * This is a placeholder for future functionality.
   *
   * @param projectId - Project ID
   * @returns Array of version metadata
   */
  async listVersions(projectId: string): Promise<UploadResponse[]> {
    throw new ProjectDataApiError('listVersions endpoint not yet implemented', 501)
  }
}

// ============================================================================
// React Hook Helpers
// ============================================================================

/**
 * Hook options for useProjectData
 */
export interface UseProjectDataOptions {
  projectId: string
  version?: number
  sampleOnly?: boolean
  autoFetch?: boolean
}

/**
 * Hook state for useProjectData
 */
export interface UseProjectDataState {
  data: DataRow[] | null
  metadata: ProjectDataMetadata | null
  loading: boolean
  error: string | null
}

/**
 * Hook result for useProjectData
 */
export interface UseProjectDataResult extends UseProjectDataState {
  fetch: () => Promise<void>
  upload: (data: DataRow[], metadata: UploadMetadata) => Promise<void>
  deleteVersion: (version: number) => Promise<void>
  refresh: () => Promise<void>
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate data structure before upload
 *
 * @param data - Data to validate
 * @returns Validation result with errors
 */
export function validateDataStructure(data: unknown): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!Array.isArray(data)) {
    errors.push('Data must be an array')
    return { valid: false, errors }
  }

  if (data.length === 0) {
    return { valid: true, errors: [] }
  }

  const firstRow = data[0]
  if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
    errors.push('Data must be an array of objects')
    return { valid: false, errors }
  }

  const keys = Object.keys(firstRow)
  if (keys.length === 0) {
    errors.push('Data objects must have at least one property')
  }

  // Check consistency (first 10 rows)
  const sampleSize = Math.min(data.length, 10)
  for (let i = 1; i < sampleSize; i++) {
    const row = data[i]
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      errors.push(`Row ${i} is not an object`)
      continue
    }

    const rowKeys = Object.keys(row)
    if (JSON.stringify(rowKeys.sort()) !== JSON.stringify(keys.sort())) {
      errors.push(`Row ${i} has inconsistent keys`)
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Format data size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted string
 */
export function formatDataSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Estimate upload time based on data size
 *
 * @param dataSize - Size in bytes
 * @param networkSpeed - Network speed in bytes/second (default: 1MB/s)
 * @returns Estimated time in seconds
 */
export function estimateUploadTime(
  dataSize: number,
  networkSpeed: number = 1024 * 1024
): number {
  const compressionRatio = 3 // Typical compression ratio
  const compressedSize = dataSize / compressionRatio
  return Math.ceil(compressedSize / networkSpeed)
}

// ============================================================================
// Export
// ============================================================================

export default projectDataClient
