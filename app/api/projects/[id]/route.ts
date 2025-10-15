import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'

/**
 * DELETE /api/projects/[id]
 * Delete a project and all associated data
 */
const deleteHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    console.log('[API PROJECT DELETE] Deleting project:', projectId, 'for user:', authUser.uid)

    // Get database user
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      console.log('[API PROJECT DELETE] User not found in database')
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
      console.log('[API PROJECT DELETE] Project not found:', projectId)
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    if (project.userId !== dbUser.id) {
      console.log('[API PROJECT DELETE] Authorization failed: User does not own project')
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this project' },
        { status: 403 }
      )
    }

    // Delete associated data first
    const deletedDataCount = await db.projectData.deleteMany({
      where: { projectId }
    })

    console.log('[API PROJECT DELETE] Deleted', deletedDataCount.count, 'project data records')

    // Delete the project
    await db.projects.delete({
      where: { id: projectId }
    })

    console.log('[API PROJECT DELETE] Project deleted successfully')

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
      deletedDataRecords: deletedDataCount.count
    })
  } catch (error) {
    console.error('[API PROJECT DELETE] Error deleting project:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete project',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
})

export const DELETE = withRateLimit(RATE_LIMITS.SESSION, deleteHandler)
