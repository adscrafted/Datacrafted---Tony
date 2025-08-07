import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { db } from './db'
import type { DataRow } from './store'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Ensure upload directory exists
 */
export async function ensureUploadDir(): Promise<void> {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

/**
 * Generate file hash for deduplication
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Generate unique filename
 */
export function generateFileName(originalName: string, hash: string): string {
  const ext = path.extname(originalName)
  const timestamp = Date.now()
  return `${timestamp}_${hash.substring(0, 8)}${ext}`
}

/**
 * Save uploaded file and store metadata
 */
export async function saveUploadedFile(
  sessionId: string,
  file: {
    name: string
    data: Buffer
    size: number
    type: string
  },
  parsedData: DataRow[]
): Promise<string> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  await ensureUploadDir()

  const fileHash = generateFileHash(file.data)
  const fileName = generateFileName(file.name, fileHash)
  const filePath = path.join(UPLOAD_DIR, fileName)

  // Check if file with same hash already exists
  const existingFile = await db.uploadedFile.findFirst({
    where: {
      fileHash,
      sessionId,
    },
  })

  if (existingFile) {
    return existingFile.id
  }

  // Save file to disk
  await fs.writeFile(filePath, file.data)

  // Generate data schema
  const dataSchema = generateDataSchema(parsedData)

  // Store file metadata in database
  const uploadedFile = await db.uploadedFile.create({
    data: {
      fileName,
      originalName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      fileHash,
      filePath,
      parsedData: JSON.stringify(parsedData),
      dataSchema: JSON.stringify(dataSchema),
      sessionId,
    },
  })

  return uploadedFile.id
}

/**
 * Generate data schema from parsed data
 */
function generateDataSchema(data: DataRow[]): Record<string, any> {
  if (data.length === 0) {
    return {}
  }

  const schema: Record<string, any> = {}
  const sample = data[0]

  for (const [key, value] of Object.entries(sample)) {
    schema[key] = {
      type: typeof value,
      nullable: data.some(row => row[key] === null || row[key] === undefined),
      examples: data.slice(0, 3).map(row => row[key]).filter(Boolean),
    }
  }

  return schema
}

/**
 * Get uploaded file data
 */
export async function getUploadedFile(fileId: string): Promise<{
  metadata: any
  parsedData: DataRow[]
} | null> {
  const file = await db.uploadedFile.findUnique({
    where: { id: fileId },
    include: {
      session: true,
    },
  })

  if (!file) {
    return null
  }

  const parsedData = JSON.parse(file.parsedData) as DataRow[]

  return {
    metadata: {
      id: file.id,
      fileName: file.fileName,
      originalName: file.originalName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      createdAt: file.createdAt,
      dataSchema: file.dataSchema ? JSON.parse(file.dataSchema) : null,
    },
    parsedData,
  }
}

/**
 * Delete uploaded file
 */
export async function deleteUploadedFile(fileId: string): Promise<boolean> {
  try {
    const file = await db.uploadedFile.findUnique({
      where: { id: fileId },
    })

    if (!file) {
      return false
    }

    // Delete file from disk
    try {
      await fs.unlink(file.filePath)
    } catch (error) {
      console.warn('Failed to delete file from disk:', error)
    }

    // Delete from database
    await db.uploadedFile.delete({
      where: { id: fileId },
    })

    return true
  } catch (error) {
    console.error('Error deleting uploaded file:', error)
    return false
  }
}

/**
 * Clean up orphaned files
 */
export async function cleanupOrphanedFiles(): Promise<number> {
  let cleanedCount = 0

  try {
    // Get all files in upload directory
    const files = await fs.readdir(UPLOAD_DIR)

    // Get all file records from database
    const dbFiles = await db.uploadedFile.findMany({
      select: { fileName: true },
    })

    const dbFileNames = new Set(dbFiles.map(f => f.fileName))

    // Delete files that are not in database
    for (const file of files) {
      if (!dbFileNames.has(file)) {
        await fs.unlink(path.join(UPLOAD_DIR, file))
        cleanedCount++
      }
    }
  } catch (error) {
    console.error('Error cleaning up orphaned files:', error)
  }

  return cleanedCount
}