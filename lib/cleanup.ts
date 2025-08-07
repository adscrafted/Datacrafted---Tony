/**
 * Data cleanup and maintenance utilities
 */

import { db } from './db'
import { cleanupExpiredSessions } from './session'
import { cleanupOrphanedFiles } from './file-storage'

export interface CleanupStats {
  expiredSessionsCount: number
  orphanedFilesCount: number
  totalRecordsProcessed: number
  cleanupDuration: number
}

/**
 * Run a full cleanup process including expired sessions and orphaned files
 */
export async function runFullCleanup(): Promise<CleanupStats> {
  const startTime = Date.now()
  console.log('Starting full cleanup process...')

  try {
    // Clean up expired sessions
    console.log('Cleaning up expired sessions...')
    const expiredSessionsCount = await cleanupExpiredSessions()
    console.log(`Cleaned up ${expiredSessionsCount} expired sessions`)

    // Clean up orphaned files
    console.log('Cleaning up orphaned files...')
    const orphanedFilesCount = await cleanupOrphanedFiles()
    console.log(`Cleaned up ${orphanedFilesCount} orphaned files`)

    // Clean up old chat messages from inactive sessions
    console.log('Cleaning up old chat messages...')
    const oldMessagesCount = await cleanupOldChatMessages()
    console.log(`Cleaned up ${oldMessagesCount} old chat messages`)

    // Clean up analyses from deleted sessions
    console.log('Cleaning up orphaned analyses...')
    const orphanedAnalysesCount = await cleanupOrphanedAnalyses()
    console.log(`Cleaned up ${orphanedAnalysesCount} orphaned analyses`)

    const endTime = Date.now()
    const cleanupDuration = endTime - startTime

    const stats: CleanupStats = {
      expiredSessionsCount,
      orphanedFilesCount,
      totalRecordsProcessed: expiredSessionsCount + orphanedFilesCount + oldMessagesCount + orphanedAnalysesCount,
      cleanupDuration,
    }

    console.log('Cleanup completed:', stats)
    return stats

  } catch (error) {
    console.error('Cleanup process failed:', error)
    throw error
  }
}

/**
 * Clean up old chat messages from inactive sessions (older than 90 days)
 */
export async function cleanupOldChatMessages(): Promise<number> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  try {
    const result = await db.chatMessage.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo,
        },
        session: {
          isActive: false,
        },
      },
    })

    return result.count
  } catch (error) {
    console.error('Error cleaning up old chat messages:', error)
    return 0
  }
}

/**
 * Clean up analyses that belong to deleted sessions
 */
export async function cleanupOrphanedAnalyses(): Promise<number> {
  try {
    const result = await db.analysis.deleteMany({
      where: {
        session: {
          isActive: false,
        },
      },
    })

    return result.count
  } catch (error) {
    console.error('Error cleaning up orphaned analyses:', error)
    return 0
  }
}

/**
 * Get database statistics for monitoring
 */
export async function getDatabaseStats() {
  try {
    const [
      totalSessions,
      activeSessions,
      totalFiles,
      totalAnalyses,
      totalChatMessages,
      totalCharts,
    ] = await Promise.all([
      db.session.count(),
      db.session.count({ where: { isActive: true } }),
      db.uploadedFile.count(),
      db.analysis.count(),
      db.chatMessage.count(),
      db.chart.count(),
    ])

    // Get storage size estimation (rough calculation)
    const avgFileSize = await db.uploadedFile.aggregate({
      _avg: {
        fileSize: true,
      },
    })

    const estimatedStorageBytes = totalFiles * (avgFileSize._avg.fileSize || 0)

    return {
      sessions: {
        total: totalSessions,
        active: activeSessions,
        inactive: totalSessions - activeSessions,
      },
      files: {
        total: totalFiles,
        estimatedStorageBytes,
        estimatedStorageMB: Math.round(estimatedStorageBytes / (1024 * 1024)),
      },
      analyses: totalAnalyses,
      chatMessages: totalChatMessages,
      charts: totalCharts,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Error getting database stats:', error)
    throw error
  }
}

/**
 * Schedule cleanup to run periodically
 */
export function schedulePeriodicCleanup() {
  // Run cleanup every 24 hours
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

  console.log('Scheduling periodic cleanup every 24 hours...')

  setInterval(async () => {
    try {
      console.log('Running scheduled cleanup...')
      await runFullCleanup()
    } catch (error) {
      console.error('Scheduled cleanup failed:', error)
    }
  }, CLEANUP_INTERVAL)

  // Run initial cleanup after 1 minute
  setTimeout(async () => {
    try {
      console.log('Running initial cleanup...')
      await runFullCleanup()
    } catch (error) {
      console.error('Initial cleanup failed:', error)
    }
  }, 60 * 1000) // 1 minute
}