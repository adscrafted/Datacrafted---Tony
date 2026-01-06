import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'
import { userNotFound, projectNotFound, forbidden, databaseError } from '@/lib/utils/api-errors'

const isDev = process.env.NODE_ENV === 'development'
const log = (...args: unknown[]) => { if (isDev) console.log(...args) }

/**
 * DELETE /api/projects/[id]
 * Delete a project and all associated data
 */
const deleteHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    log('[API PROJECT DELETE] Deleting project:', projectId, 'for user:', authUser.uid)

    // Get database user
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      log('[API PROJECT DELETE] User not found in database')
      return userNotFound()
    }

    // Verify project ownership
    const project = await db.projects.findUnique({
      where: { id: projectId }
    })

    if (!project) {
      log('[API PROJECT DELETE] Project not found:', projectId)
      return projectNotFound()
    }

    if (project.userId !== dbUser.id) {
      log('[API PROJECT DELETE] Authorization failed: User does not own project')
      return forbidden('You do not have access to this project')
    }

    // Delete associated data first
    const deletedDataCount = await db.projectData.deleteMany({
      where: { projectId }
    })

    log('[API PROJECT DELETE] Deleted', deletedDataCount.count, 'project data records')

    // Delete the project
    await db.projects.delete({
      where: { id: projectId }
    })

    log('[API PROJECT DELETE] Project deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
      deletedDataRecords: deletedDataCount.count
    })
  } catch (error) {
    console.error('[API PROJECT DELETE] Error deleting project:', error)
    return databaseError('delete project', error)
  }
})

export const DELETE = withRateLimit(RATE_LIMITS.SESSION, deleteHandler)
