/**
 * React Hook for Project Data
 *
 * Provides a convenient interface for fetching and managing project data
 * in React components.
 *
 * @example Basic usage
 * ```typescript
 * function MyComponent({ projectId }: { projectId: string }) {
 *   const { data, loading, error, upload } = useProjectData({
 *     projectId,
 *     sampleOnly: true,
 *     autoFetch: true
 *   })
 *
 *   if (loading) return <div>Loading...</div>
 *   if (error) return <div>Error: {error}</div>
 *
 *   return <div>Rows: {data?.length}</div>
 * }
 * ```
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  projectDataClient,
  type DataRow,
  type UploadMetadata,
  type ProjectDataMetadata,
  type UseProjectDataOptions,
  type UseProjectDataResult
} from '@/lib/api/project-data-client'

/**
 * Hook for managing project data
 *
 * @param options - Hook configuration options
 * @returns Hook state and methods
 */
export function useProjectData(
  options: UseProjectDataOptions
): UseProjectDataResult {
  const { projectId, version, sampleOnly = false, autoFetch = true } = options

  const [data, setData] = useState<DataRow[] | null>(null)
  const [metadata, setMetadata] = useState<ProjectDataMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch data from API
   */
  const fetch = useCallback(async () => {
    if (!projectId) {
      setError('Project ID is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await projectDataClient.fetch(projectId, {
        version,
        sampleOnly
      })

      setData(result.data)
      setMetadata(result.metadata)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data'
      setError(errorMessage)
      console.error('[useProjectData] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId, version, sampleOnly])

  /**
   * Upload new data
   */
  const upload = useCallback(
    async (newData: DataRow[], uploadMetadata: UploadMetadata) => {
      if (!projectId) {
        setError('Project ID is required')
        return
      }

      setLoading(true)
      setError(null)

      try {
        await projectDataClient.upload(projectId, newData, {
          metadata: uploadMetadata,
          version
        })

        // Refresh data after successful upload
        await fetch()
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload data'
        setError(errorMessage)
        console.error('[useProjectData] Upload error:', err)
        throw err // Re-throw so caller can handle
      } finally {
        setLoading(false)
      }
    },
    [projectId, version, fetch]
  )

  /**
   * Delete a specific version
   */
  const deleteVersion = useCallback(
    async (versionToDelete: number) => {
      if (!projectId) {
        setError('Project ID is required')
        return
      }

      setLoading(true)
      setError(null)

      try {
        await projectDataClient.delete(projectId, versionToDelete)

        // Clear data if we deleted the current version
        if (versionToDelete === version) {
          setData(null)
          setMetadata(null)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete version'
        setError(errorMessage)
        console.error('[useProjectData] Delete error:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [projectId, version]
  )

  /**
   * Refresh data (alias for fetch)
   */
  const refresh = useCallback(async () => {
    await fetch()
  }, [fetch])

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch && projectId) {
      fetch()
    }
  }, [autoFetch, projectId, version, sampleOnly, fetch])

  return {
    data,
    metadata,
    loading,
    error,
    fetch,
    upload,
    deleteVersion,
    refresh
  }
}

/**
 * Hook for uploading data with progress tracking
 *
 * @example
 * ```typescript
 * function UploadComponent({ projectId }: { projectId: string }) {
 *   const { upload, uploading, progress, error } = useProjectDataUpload()
 *
 *   const handleUpload = async () => {
 *     await upload(projectId, myData, {
 *       fileName: 'data.csv',
 *       fileSize: 1024
 *     })
 *   }
 *
 *   return (
 *     <button onClick={handleUpload} disabled={uploading}>
 *       {uploading ? `Uploading ${progress}%` : 'Upload'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useProjectDataUpload() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(
    async (
      projectId: string,
      data: DataRow[],
      metadata: UploadMetadata,
      version?: number
    ) => {
      setUploading(true)
      setProgress(0)
      setError(null)

      try {
        // Simulate progress for UX (actual upload is fast due to compression)
        setProgress(10)

        const result = await projectDataClient.upload(projectId, data, {
          metadata,
          version
        })

        setProgress(100)
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed'
        setError(errorMessage)
        console.error('[useProjectDataUpload] Error:', err)
        throw err
      } finally {
        setUploading(false)
        // Reset progress after a delay
        setTimeout(() => setProgress(0), 1000)
      }
    },
    []
  )

  return {
    upload,
    uploading,
    progress,
    error
  }
}

/**
 * Hook for fetching multiple versions
 *
 * @example
 * ```typescript
 * function VersionsComponent({ projectId }: { projectId: string }) {
 *   const { versions, loading, fetchVersion } = useProjectDataVersions(projectId)
 *
 *   return (
 *     <div>
 *       {versions.map(v => (
 *         <div key={v.version}>Version {v.version}</div>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useProjectDataVersions(projectId: string) {
  const [versions, setVersions] = useState<Array<{
    version: number
    metadata: ProjectDataMetadata
    createdAt: string
  }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVersion = useCallback(
    async (version: number) => {
      if (!projectId) return null

      try {
        const result = await projectDataClient.fetch(projectId, {
          version,
          sampleOnly: true // Only fetch metadata
        })

        return {
          version: result.version,
          metadata: result.metadata,
          createdAt: result.createdAt
        }
      } catch (err) {
        console.error('[useProjectDataVersions] Error fetching version:', err)
        return null
      }
    },
    [projectId]
  )

  // Note: This is a placeholder implementation
  // A proper implementation would require a list versions endpoint
  useEffect(() => {
    if (!projectId) return

    setLoading(true)
    setError(null)

    // For now, just fetch the latest version
    fetchVersion(0)
      .then(result => {
        if (result) {
          setVersions([result])
        }
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to fetch versions')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [projectId, fetchVersion])

  return {
    versions,
    loading,
    error,
    fetchVersion
  }
}

/**
 * Hook for data validation before upload
 *
 * @example
 * ```typescript
 * function ValidationComponent() {
 *   const { validate, isValid, errors } = useProjectDataValidation()
 *
 *   const handleValidate = () => {
 *     validate(myData)
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleValidate}>Validate</button>
 *       {!isValid && errors.map(err => <div key={err}>{err}</div>)}
 *     </div>
 *   )
 * }
 * ```
 */
export function useProjectDataValidation() {
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  const validate = useCallback((data: unknown) => {
    const validationErrors: string[] = []
    const validationWarnings: string[] = []

    // Check if array
    if (!Array.isArray(data)) {
      validationErrors.push('Data must be an array')
      setIsValid(false)
      setErrors(validationErrors)
      setWarnings([])
      return false
    }

    // Check if empty
    if (data.length === 0) {
      validationWarnings.push('Data is empty')
    }

    // Check structure
    if (data.length > 0) {
      const firstRow = data[0]

      if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
        validationErrors.push('Data must be an array of objects')
      } else {
        const keys = Object.keys(firstRow)

        if (keys.length === 0) {
          validationErrors.push('Data objects must have at least one property')
        }

        // Check size limits
        if (data.length > 1_000_000) {
          validationErrors.push(`Too many rows: ${data.length} (max: 1,000,000)`)
        }

        if (keys.length > 1000) {
          validationErrors.push(`Too many columns: ${keys.length} (max: 1,000)`)
        }

        // Check data size
        const jsonSize = JSON.stringify(data).length
        const maxSize = 50 * 1024 * 1024 // 50MB

        if (jsonSize > maxSize) {
          validationErrors.push(
            `Data size too large: ${(jsonSize / 1024 / 1024).toFixed(2)}MB (max: 50MB)`
          )
        } else if (jsonSize > maxSize * 0.8) {
          validationWarnings.push(
            `Data size is close to limit: ${(jsonSize / 1024 / 1024).toFixed(2)}MB (max: 50MB)`
          )
        }
      }
    }

    const valid = validationErrors.length === 0
    setIsValid(valid)
    setErrors(validationErrors)
    setWarnings(validationWarnings)

    return valid
  }, [])

  const reset = useCallback(() => {
    setIsValid(null)
    setErrors([])
    setWarnings([])
  }, [])

  return {
    validate,
    reset,
    isValid,
    errors,
    warnings
  }
}

// Export all hooks
export default useProjectData
