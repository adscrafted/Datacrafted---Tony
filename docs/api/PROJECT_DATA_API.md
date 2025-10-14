# Project Data API Documentation

Complete API documentation for storing and retrieving project data with compression, validation, and versioning.

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Data Format](#data-format)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Examples](#examples)

---

## Overview

The Project Data API provides secure, efficient storage and retrieval of tabular data for projects. All data is compressed using gzip before storage and decompressed on retrieval.

### Key Features

- **Compression**: Automatic gzip compression (typically 3-5x reduction)
- **Validation**: Data quality checks and schema inference
- **Versioning**: Multiple data versions per project
- **Sample Data**: Fast preview with cached samples
- **Security**: Firebase authentication + authorization
- **Rate Limiting**: Protection against abuse

### Technical Specifications

| Specification | Value |
|--------------|-------|
| Max Data Size | 50MB uncompressed |
| Max Rows | 1,000,000 |
| Max Columns | 1,000 |
| Compression Algorithm | gzip (level 6) |
| Sample Size | 100 rows |

---

## Authentication

All endpoints require Firebase authentication via Bearer token.

```http
Authorization: Bearer <firebase-id-token>
```

### Getting a Firebase Token

```typescript
import { auth } from '@/lib/config/firebase'

const token = await auth.currentUser?.getIdToken()
```

---

## Endpoints

### POST /api/projects/[id]/data

Upload and store project data with automatic compression.

**Rate Limit:** 10 requests per hour

#### Request

```http
POST /api/projects/abc123/data
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "data": [
    { "id": 1, "name": "Alice", "score": 95 },
    { "id": 2, "name": "Bob", "score": 87 }
  ],
  "metadata": {
    "fileName": "test-data.csv",
    "fileSize": 2048,
    "mimeType": "text/csv"
  },
  "version": 1
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | `Array<Object>` | Yes | Array of data rows (objects with consistent structure) |
| `metadata.fileName` | `string` | Yes | Original file name |
| `metadata.fileSize` | `number` | No | Original file size in bytes |
| `metadata.mimeType` | `string` | No | MIME type (default: application/json) |
| `version` | `number` | No | Version number (auto-increments if not provided) |

#### Response (201 Created)

```json
{
  "id": "clx123...",
  "projectId": "abc123",
  "version": 1,
  "metadata": {
    "originalFileName": "test-data.csv",
    "rowCount": 2,
    "columnCount": 3,
    "columnNames": ["id", "name", "score"],
    "columnTypes": {
      "id": "number",
      "name": "string",
      "score": "number"
    },
    "dataQualityScore": 100
  },
  "createdAt": "2025-10-11T10:30:00.000Z",
  "updatedAt": "2025-10-11T10:30:00.000Z"
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid data structure or validation failed |
| 403 | User does not own the project |
| 404 | Project not found |
| 413 | Data size exceeds maximum (50MB) |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

### GET /api/projects/[id]/data

Retrieve project data (compressed or sample).

**Rate Limit:** 30 requests per minute

#### Request

```http
GET /api/projects/abc123/data?version=1&sampleOnly=true
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `version` | `number` | No | Specific version to retrieve (default: latest) |
| `sampleOnly` | `boolean` | No | Return only sample data (100 rows) for fast preview |

#### Response (200 OK)

```json
{
  "id": "clx123...",
  "projectId": "abc123",
  "version": 1,
  "data": [
    { "id": 1, "name": "Alice", "score": 95 },
    { "id": 2, "name": "Bob", "score": 87 }
  ],
  "metadata": {
    "originalFileName": "test-data.csv",
    "originalFileSize": 2048,
    "rowCount": 2,
    "columnCount": 3,
    "columnNames": ["id", "name", "score"],
    "columnTypes": {
      "id": "number",
      "name": "string",
      "score": "number"
    },
    "dataQualityScore": 100,
    "compressionRatio": 3.45
  },
  "createdAt": "2025-10-11T10:30:00.000Z",
  "updatedAt": "2025-10-11T10:30:00.000Z",
  "isSample": true
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 403 | User does not own the project |
| 404 | Project or data not found |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

### DELETE /api/projects/[id]/data

Soft delete a data version (marks as inactive).

**Rate Limit:** 30 requests per minute

#### Request

```http
DELETE /api/projects/abc123/data?version=1
Authorization: Bearer <token>
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `version` | `number` | Yes | Version number to delete |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Version 1 deleted successfully"
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Version parameter missing |
| 403 | User does not own the project |
| 404 | Version not found or already deleted |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Data Format

### Valid Data Structure

Data must be an array of objects with consistent keys:

```typescript
// Valid
[
  { id: 1, name: "Alice", score: 95 },
  { id: 2, name: "Bob", score: 87 }
]

// Invalid - inconsistent keys
[
  { id: 1, name: "Alice" },
  { id: 2, score: 87 }  // Missing 'name'
]

// Invalid - not an array of objects
[1, 2, 3, 4]
```

### Column Types

The API automatically infers column types:

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text values | "Alice", "hello" |
| `number` | Numeric values | 42, 3.14 |
| `boolean` | True/false values | true, false |
| `date` | Date strings | "2025-10-11", "2025-10-11T10:30:00Z" |
| `null` | All null values | null |
| `mixed` | Multiple types in same column | 1, "two", 3 |

### Data Quality Metrics

Each upload calculates quality metrics:

```typescript
{
  rowCount: 1000,
  columnCount: 10,
  nullCount: 5,           // Total null/empty values
  duplicateRowCount: 2,   // Duplicate rows
  dataQualityScore: 95.5, // Overall score (0-100)
  completeness: 99.5,     // % non-null values
  uniqueness: 99.8        // % unique rows
}
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": "Brief error message",
  "details": "Detailed explanation or array of validation errors"
}
```

### Common Validation Errors

```json
// Data too large
{
  "error": "Data size exceeds maximum allowed size",
  "details": "Data size: 75.5 MB, Maximum: 50 MB"
}

// Too many rows
{
  "error": "Data validation failed",
  "details": [
    "Data exceeds maximum row count: 1500000 > 1000000"
  ]
}

// Invalid structure
{
  "error": "Invalid data: must be an array of objects",
  "details": null
}
```

---

## Rate Limits

Rate limits are applied per IP address:

| Endpoint | Limit | Window | Reason |
|----------|-------|--------|--------|
| POST | 10 requests | 1 hour | Expensive compression/storage |
| GET | 30 requests | 1 minute | Moderate load |
| DELETE | 30 requests | 1 minute | Low cost operation |

### Rate Limit Headers

Responses include rate limit information:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1696156800000
```

When rate limited:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600

{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 3600 seconds.",
  "limit": 10,
  "resetAt": "2025-10-11T11:30:00.000Z"
}
```

---

## Examples

### Complete TypeScript Client

```typescript
import { auth } from '@/lib/config/firebase'

interface ProjectDataClient {
  upload: (projectId: string, data: any[], metadata: any) => Promise<any>
  fetch: (projectId: string, options?: { version?: number, sampleOnly?: boolean }) => Promise<any>
  delete: (projectId: string, version: number) => Promise<any>
}

const projectDataClient: ProjectDataClient = {
  async upload(projectId, data, metadata) {
    const token = await auth.currentUser?.getIdToken()

    const response = await fetch(`/api/projects/${projectId}/data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data, metadata })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    return response.json()
  },

  async fetch(projectId, options = {}) {
    const token = await auth.currentUser?.getIdToken()
    const params = new URLSearchParams()

    if (options.version) {
      params.append('version', options.version.toString())
    }
    if (options.sampleOnly) {
      params.append('sampleOnly', 'true')
    }

    const url = `/api/projects/${projectId}/data?${params}`
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Fetch failed')
    }

    return response.json()
  },

  async delete(projectId, version) {
    const token = await auth.currentUser?.getIdToken()

    const response = await fetch(
      `/api/projects/${projectId}/data?version=${version}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Delete failed')
    }

    return response.json()
  }
}

// Usage examples
async function examples() {
  // Upload data
  const uploadResult = await projectDataClient.upload(
    'project-123',
    [
      { id: 1, name: 'Alice', score: 95 },
      { id: 2, name: 'Bob', score: 87 }
    ],
    {
      fileName: 'test-data.csv',
      fileSize: 2048,
      mimeType: 'text/csv'
    }
  )
  console.log('Uploaded:', uploadResult)

  // Fetch sample data (fast)
  const sample = await projectDataClient.fetch('project-123', {
    sampleOnly: true
  })
  console.log('Sample:', sample.data.length, 'rows')

  // Fetch full data
  const fullData = await projectDataClient.fetch('project-123')
  console.log('Full data:', fullData.data.length, 'rows')

  // Fetch specific version
  const v1Data = await projectDataClient.fetch('project-123', {
    version: 1
  })
  console.log('Version 1:', v1Data)

  // Delete version
  await projectDataClient.delete('project-123', 1)
  console.log('Version 1 deleted')
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react'

interface UseProjectDataOptions {
  projectId: string
  version?: number
  sampleOnly?: boolean
  autoFetch?: boolean
}

function useProjectData(options: UseProjectDataOptions) {
  const [data, setData] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await projectDataClient.fetch(
        options.projectId,
        {
          version: options.version,
          sampleOnly: options.sampleOnly
        }
      )
      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const upload = async (newData: any[], metadata: any) => {
    setLoading(true)
    setError(null)

    try {
      await projectDataClient.upload(options.projectId, newData, metadata)
      await fetch() // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetch()
    }
  }, [options.projectId, options.version, options.sampleOnly])

  return { data, loading, error, fetch, upload }
}

// Usage in component
function ProjectDataViewer({ projectId }: { projectId: string }) {
  const { data, loading, error } = useProjectData({
    projectId,
    sampleOnly: true,
    autoFetch: true
  })

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  if (!data) return <div>No data</div>

  return (
    <table>
      <thead>
        <tr>
          {Object.keys(data[0]).map(key => (
            <th key={key}>{key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {Object.values(row).map((value: any, j) => (
              <td key={j}>{String(value)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

---

## Performance Optimization

### Best Practices

1. **Use Sample Data for Previews**
   ```typescript
   // Fast - returns cached sample (100 rows)
   const preview = await fetch(projectId, { sampleOnly: true })
   ```

2. **Version Management**
   ```typescript
   // Keep only recent versions, delete old ones
   await projectDataClient.delete(projectId, oldVersion)
   ```

3. **Compression Efficiency**
   - Structured data compresses better (3-5x reduction)
   - Avoid deeply nested objects
   - Use consistent data types per column

4. **Batch Operations**
   ```typescript
   // Upload once, not per row
   await upload(projectId, allRows, metadata)
   ```

### Monitoring Performance

```typescript
const startTime = performance.now()
const result = await projectDataClient.upload(projectId, data, metadata)
const duration = performance.now() - startTime

console.log('Upload performance:', {
  duration: `${duration.toFixed(0)}ms`,
  rowCount: data.length,
  compressionRatio: result.metadata.compressionRatio
})
```

---

## Security Considerations

### Authorization

- Users can only access their own projects
- Authorization checked on every request
- Project ownership validated via database

### Data Validation

- Max size: 50MB uncompressed
- Max rows: 1M, Max columns: 1K
- Data structure validation
- SQL injection protection (parameterized queries)

### Rate Limiting

- Prevents brute force attacks
- Protects against DOS attacks
- Configurable per endpoint

### Best Practices

1. **Never expose Firebase tokens**
   ```typescript
   // Bad
   const token = '<hardcoded-token>'

   // Good
   const token = await auth.currentUser?.getIdToken()
   ```

2. **Validate data client-side**
   ```typescript
   if (data.length > 1000000) {
     throw new Error('Too many rows')
   }
   ```

3. **Handle errors gracefully**
   ```typescript
   try {
     await upload(...)
   } catch (error) {
     console.error('Upload failed:', error)
     // Show user-friendly message
   }
   ```

---

## Troubleshooting

### Common Issues

**Issue: 413 Payload Too Large**
```
Solution: Reduce data size or split into multiple uploads
```

**Issue: 400 Validation Failed**
```
Solution: Check data structure consistency (all rows have same keys)
```

**Issue: 429 Rate Limit Exceeded**
```
Solution: Wait for rate limit window to reset (check Retry-After header)
```

**Issue: 403 Forbidden**
```
Solution: Verify user owns the project and is authenticated
```

**Issue: Slow upload/download**
```
Solution:
- Use sampleOnly for previews
- Compress data before sending (already automatic)
- Check network connection
```

---

## Migration Guide

### From Session Data to Project Data

```typescript
// Old (session-based)
await fetch(`/api/sessions/${sessionId}/data`, {
  method: 'POST',
  body: JSON.stringify({ data })
})

// New (project-based with compression)
await fetch(`/api/projects/${projectId}/data`, {
  method: 'POST',
  body: JSON.stringify({
    data,
    metadata: {
      fileName: 'data.csv',
      fileSize: data.length
    }
  })
})
```

---

## Support

For issues or questions:
- Check error messages in response
- Review validation requirements
- Check rate limit headers
- Enable debug logging in development

Debug mode example:
```typescript
const DEBUG = process.env.NODE_ENV === 'development'

if (DEBUG) {
  console.log('Uploading data:', {
    rows: data.length,
    size: JSON.stringify(data).length
  })
}
```
