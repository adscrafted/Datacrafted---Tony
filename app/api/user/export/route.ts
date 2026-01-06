import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'

/**
 * GET /api/user/export
 * Export all user data for GDPR compliance
 *
 * Rate limit: 10 requests per minute (to prevent abuse)
 *
 * Request headers:
 * - Authorization: Bearer <firebase-token>
 *
 * Response:
 * - 200: JSON containing all user data
 * - 401: Unauthorized
 * - 404: User not found
 * - 429: Too Many Requests
 * - 500: Internal server error
 */
const getHandler = withAuth(async (request: NextRequest, firebaseUser) => {
  try {
    console.log('[API] Exporting user data:', firebaseUser.uid)

    // Get user with all related data
    const user = await db.user.findUnique({
      where: { firebaseUid: firebaseUser.uid },
      include: {
        projects: {
          include: {
            projectData: {
              select: {
                id: true,
                createdAt: true,
                originalFileName: true,
                originalFileSize: true,
                mimeType: true,
                rowCount: true,
                columnCount: true,
                columnNames: true,
                hasAnalysis: true,
                status: true,
              },
            },
            chatConversations: {
              include: {
                messages: {
                  select: {
                    id: true,
                    createdAt: true,
                    role: true,
                    content: true,
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        },
        sessions: {
          select: {
            id: true,
            createdAt: true,
            name: true,
            description: true,
            isActive: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Format the export data
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0',
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      subscription: {
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
        endDate: user.subscriptionEndDate,
      },
      usage: {
        analysisCount: user.analysisCount,
        chatMessageCount: user.chatMessageCount,
        chatCountResetDate: user.chatCountResetDate,
      },
      projects: user.projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        datasets: project.projectData.map((data) => ({
          id: data.id,
          fileName: data.originalFileName,
          fileSize: data.originalFileSize,
          mimeType: data.mimeType,
          rowCount: data.rowCount,
          columnCount: data.columnCount,
          columns: JSON.parse(data.columnNames || '[]'),
          hasAnalysis: data.hasAnalysis,
          status: data.status,
          createdAt: data.createdAt,
        })),
        conversations: project.chatConversations.map((conv) => ({
          id: conv.id,
          name: conv.name,
          messageCount: conv.messageCount,
          createdAt: conv.createdAt,
          messages: conv.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
          })),
        })),
      })),
      sessions: user.sessions.map((session) => ({
        id: session.id,
        name: session.name,
        description: session.description,
        isActive: session.isActive,
        createdAt: session.createdAt,
      })),
    }

    console.log('[API] User data exported successfully:', firebaseUser.uid)

    return NextResponse.json(exportData)
  } catch (error) {
    console.error('[API] Error exporting user data:', error)
    return NextResponse.json(
      { error: 'Failed to export user data' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.AUTH, getHandler)
