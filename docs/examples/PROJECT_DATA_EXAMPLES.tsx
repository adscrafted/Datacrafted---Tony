/**
 * Project Data API - Complete Usage Examples
 *
 * This file contains real-world examples of using the Project Data API
 * in various scenarios.
 */

'use client'

import { useState } from 'react'
import { useProjectData, useProjectDataUpload, useProjectDataValidation } from '@/lib/hooks/use-project-data'
import { projectDataClient, formatDataSize } from '@/lib/api/project-data-client'

// ============================================================================
// Example 1: Simple Data Display
// ============================================================================

/**
 * Display project data in a table with loading state
 */
export function SimpleDataDisplay({ projectId }: { projectId: string }) {
  const { data, loading, error, metadata } = useProjectData({
    projectId,
    sampleOnly: true, // Fast preview
    autoFetch: true
  })

  if (loading) {
    return <div className="p-4">Loading data...</div>
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>
  }

  if (!data || data.length === 0) {
    return <div className="p-4 text-gray-500">No data available</div>
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          {metadata?.originalFileName || 'Project Data'}
        </h3>
        <p className="text-sm text-gray-600">
          {metadata?.rowCount.toLocaleString()} rows × {metadata?.columnCount} columns
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              {Object.keys(data[0]).map(key => (
                <th key={key} className="border border-gray-300 px-4 py-2 text-left">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {Object.values(row).map((value, j) => (
                  <td key={j} className="border border-gray-300 px-4 py-2">
                    {String(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// Example 2: File Upload with Validation
// ============================================================================

/**
 * Upload CSV/JSON data with validation
 */
export function DataUploader({ projectId }: { projectId: string }) {
  const { upload, uploading, progress, error } = useProjectDataUpload()
  const { validate, isValid, errors } = useProjectDataValidation()
  const [file, setFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      // Read file
      const text = await file.text()
      let data: any[]

      // Parse based on file type
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text)
      } else if (file.name.endsWith('.csv')) {
        data = parseCSV(text)
      } else {
        alert('Unsupported file type')
        return
      }

      // Validate
      const valid = validate(data)
      if (!valid) {
        alert(`Validation failed:\n${errors.join('\n')}`)
        return
      }

      // Upload
      await upload(projectId, data, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      })

      alert('Upload successful!')
      setFile(null)
    } catch (err) {
      console.error('Upload error:', err)
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Select Data File
        </label>
        <input
          type="file"
          accept=".csv,.json"
          onChange={handleFileChange}
          className="block w-full text-sm border rounded p-2"
          disabled={uploading}
        />
      </div>

      {file && (
        <div className="text-sm text-gray-600">
          <p>File: {file.name}</p>
          <p>Size: {formatDataSize(file.size)}</p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm font-medium text-red-800 mb-1">Validation Errors:</p>
          <ul className="text-sm text-red-600 list-disc list-inside">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
      >
        {uploading ? `Uploading ${progress}%` : 'Upload'}
      </button>

      {error && (
        <div className="text-sm text-red-500">
          {error}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Example 3: Data Version Manager
// ============================================================================

/**
 * Manage multiple data versions
 */
export function DataVersionManager({ projectId }: { projectId: string }) {
  const [selectedVersion, setSelectedVersion] = useState<number>(0)
  const { data, metadata, loading, error, fetch } = useProjectData({
    projectId,
    version: selectedVersion || undefined,
    sampleOnly: true,
    autoFetch: true
  })

  const handleDeleteVersion = async (version: number) => {
    if (!confirm(`Delete version ${version}?`)) return

    try {
      await projectDataClient.delete(projectId, version)
      alert('Version deleted')
      await fetch()
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Select Version
        </label>
        <select
          value={selectedVersion}
          onChange={(e) => setSelectedVersion(parseInt(e.target.value))}
          className="block w-full border rounded p-2"
        >
          <option value={0}>Latest</option>
          <option value={1}>Version 1</option>
          <option value={2}>Version 2</option>
          <option value={3}>Version 3</option>
        </select>
      </div>

      {loading && <div>Loading...</div>}

      {error && <div className="text-red-500">{error}</div>}

      {metadata && (
        <div className="p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">Version Information</h4>
          <dl className="text-sm space-y-1">
            <div>
              <dt className="inline font-medium">File:</dt>
              <dd className="inline ml-2">{metadata.originalFileName}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Rows:</dt>
              <dd className="inline ml-2">{metadata.rowCount.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Columns:</dt>
              <dd className="inline ml-2">{metadata.columnCount}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Quality Score:</dt>
              <dd className="inline ml-2">
                {metadata.dataQualityScore?.toFixed(1) || 'N/A'}%
              </dd>
            </div>
            {metadata.compressionRatio && (
              <div>
                <dt className="inline font-medium">Compression:</dt>
                <dd className="inline ml-2">
                  {metadata.compressionRatio.toFixed(2)}x
                </dd>
              </div>
            )}
          </dl>

          {selectedVersion > 0 && (
            <button
              onClick={() => handleDeleteVersion(selectedVersion)}
              className="mt-3 px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
            >
              Delete Version
            </button>
          )}
        </div>
      )}

      {data && data.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Sample Data (first 5 rows)</h4>
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
            {JSON.stringify(data.slice(0, 5), null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Example 4: Data Statistics Dashboard
// ============================================================================

/**
 * Display data statistics and quality metrics
 */
export function DataStatistics({ projectId }: { projectId: string }) {
  const { data, metadata, loading } = useProjectData({
    projectId,
    sampleOnly: false, // Full data for accurate stats
    autoFetch: true
  })

  if (loading) {
    return <div className="p-4">Loading statistics...</div>
  }

  if (!data || !metadata) {
    return <div className="p-4">No data available</div>
  }

  // Calculate statistics
  const stats = calculateStatistics(data, metadata)

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Data Statistics</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Rows"
          value={metadata.rowCount.toLocaleString()}
          color="blue"
        />
        <StatCard
          label="Columns"
          value={metadata.columnCount.toString()}
          color="green"
        />
        <StatCard
          label="Quality Score"
          value={`${metadata.dataQualityScore?.toFixed(1) || 0}%`}
          color={getQualityColor(metadata.dataQualityScore || 0)}
        />
        <StatCard
          label="Completeness"
          value={`${stats.completeness.toFixed(1)}%`}
          color="purple"
        />
      </div>

      <div className="p-4 bg-gray-50 rounded">
        <h4 className="font-medium mb-3">Column Types</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(metadata.columnTypes).map(([col, type]) => (
            <div key={col} className="flex justify-between">
              <span className="font-mono text-gray-700">{col}</span>
              <span className="text-gray-500">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Helper Components
// ============================================================================

function StatCard({
  label,
  value,
  color
}: {
  label: string
  value: string
  color: string
}) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200'
  }

  return (
    <div className={`p-4 border rounded ${bgColors[color] || bgColors.blue}`}>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simple CSV parser (for example purposes)
 */
function parseCSV(text: string): any[] {
  const lines = text.trim().split('\n')
  if (lines.length === 0) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const data: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: any = {}

    headers.forEach((header, j) => {
      row[header] = values[j]
    })

    data.push(row)
  }

  return data
}

/**
 * Calculate data statistics
 */
function calculateStatistics(data: any[], metadata: any) {
  const totalCells = metadata.rowCount * metadata.columnCount
  const filledCells = totalCells - (metadata.nullCount || 0)

  return {
    completeness: totalCells > 0 ? (filledCells / totalCells) * 100 : 100,
    uniqueness: metadata.rowCount > 0
      ? ((metadata.rowCount - (metadata.duplicateRowCount || 0)) / metadata.rowCount) * 100
      : 100
  }
}

/**
 * Get color based on quality score
 */
function getQualityColor(score: number): string {
  if (score >= 80) return 'green'
  if (score >= 60) return 'yellow'
  return 'red'
}

// ============================================================================
// Example 5: Programmatic API Usage (No React)
// ============================================================================

/**
 * Example of using the API client directly without React
 */
export async function programmaticExample() {
  try {
    // Upload data
    console.log('Uploading data...')
    const uploadResult = await projectDataClient.upload(
      'project-123',
      [
        { id: 1, name: 'Alice', score: 95 },
        { id: 2, name: 'Bob', score: 87 },
        { id: 3, name: 'Charlie', score: 92 }
      ],
      {
        metadata: {
          fileName: 'test-data.csv',
          fileSize: 1024,
          mimeType: 'text/csv'
        }
      }
    )
    console.log('Upload successful:', uploadResult)

    // Fetch sample data
    console.log('Fetching sample...')
    const sample = await projectDataClient.fetch('project-123', {
      sampleOnly: true
    })
    console.log('Sample data:', sample.data.length, 'rows')

    // Fetch full data
    console.log('Fetching full data...')
    const fullData = await projectDataClient.fetch('project-123')
    console.log('Full data:', fullData.data.length, 'rows')

    // Fetch specific version
    console.log('Fetching version 1...')
    const v1 = await projectDataClient.fetch('project-123', { version: 1 })
    console.log('Version 1:', v1.metadata.rowCount, 'rows')

    // Delete old version
    console.log('Deleting version 1...')
    await projectDataClient.delete('project-123', 1)
    console.log('Version 1 deleted')

    return true
  } catch (error) {
    console.error('Error:', error)
    return false
  }
}
