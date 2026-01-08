/**
 * Admin Cleanup API Route
 *
 * Protected admin endpoint for system maintenance operations.
 * Only accessible by whitelisted admin emails.
 *
 * GET: Retrieve system statistics
 * POST: Run cleanup operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'
import { isAdmin } from '@/lib/config/admin'

/**
 * GET - Retrieve system statistics
 */
const getHandler = withAuth(async (request: NextRequest, authUser) => {
  // Verify admin access
  if (!isAdmin(authUser.email)) {
    console.warn('[ADMIN API] Unauthorized access attempt:', authUser.email)
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    )
  }

  try {
    // Get database statistics
    const [
      totalUsers,
      totalProjects,
      totalProjectData,
      proUsers,
    ] = await Promise.all([
      db.user.count(),
      db.projects.count(),
      db.projectData.count(),
      db.user.count({ where: { subscriptionTier: 'pro' } }),
    ])

    // Calculate storage estimates
    const projectDataStats = await db.projectData.aggregate({
      _sum: {
        uncompressedSize: true,
      },
      _count: true,
    })

    const stats = {
      sessions: {
        total: totalUsers,
        active: proUsers,
        inactive: totalUsers - proUsers,
      },
      files: {
        total: totalProjectData,
        estimatedStorageBytes: projectDataStats._sum.uncompressedSize || 0,
        estimatedStorageMB: Math.round((projectDataStats._sum.uncompressedSize || 0) / 1024 / 1024),
      },
      analyses: totalProjectData,
      chatMessages: 0, // TODO: Add chat message count if table exists
      charts: totalProjects,
      lastUpdated: new Date().toISOString(),
    }

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('[ADMIN API] Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
})

/**
 * POST - Run cleanup operations
 */
const postHandler = withAuth(async (request: NextRequest, authUser) => {
  // Verify admin access
  if (!isAdmin(authUser.email)) {
    console.warn('[ADMIN API] Unauthorized cleanup attempt:', authUser.email)
    return NextResponse.json(
      { error: 'Forbidden - Admin access required' },
      { status: 403 }
    )
  }

  const startTime = Date.now()

  try {
    // Clean up inactive/old project data (older than 90 days with no activity)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    // Find and delete orphaned/inactive project data older than 90 days
    const orphanedData = await db.projectData.deleteMany({
      where: {
        isActive: false,
        updatedAt: { lt: ninetyDaysAgo },
      },
    })

    // Clean up project data marked as deleted (status = 'deleted') older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const deletedProjectData = await db.projectData.deleteMany({
      where: {
        status: 'deleted',
        updatedAt: { lt: thirtyDaysAgo },
      },
    })

    const cleanupDuration = Date.now() - startTime

    const stats = {
      deletedProjectDataCount: deletedProjectData.count,
      orphanedFilesCount: orphanedData.count,
      totalRecordsProcessed: deletedProjectData.count + orphanedData.count,
      cleanupDuration,
    }

    console.log('[ADMIN API] Cleanup completed:', stats)

    return NextResponse.json({ success: true, stats })
  } catch (error) {
    console.error('[ADMIN API] Error running cleanup:', error)
    return NextResponse.json(
      { error: 'Failed to run cleanup' },
      { status: 500 }
    )
  }
})

// Apply rate limiting (more restrictive for admin endpoints)
const ADMIN_RATE_LIMIT = { windowMs: 60 * 1000, maxRequests: 10 }

export const GET = withRateLimit(ADMIN_RATE_LIMIT, getHandler)
export const POST = withRateLimit(ADMIN_RATE_LIMIT, postHandler)
