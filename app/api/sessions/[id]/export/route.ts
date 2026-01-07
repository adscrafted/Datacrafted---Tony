import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const isDev = process.env.NODE_ENV === 'development'
const log = (...args: unknown[]) => { if (isDev) console.log(...args) }

/**
 * GET /api/sessions/[id]/export
 * Export session data (JSON or CSV format)
 *
 * PROTECTED: Requires authentication and ownership verification
 *
 * Rate limit: AUTH rate limit (10 requests per minute)
 *
 * Request headers:
 * - Authorization: Bearer <firebase-token>
 *
 * Query params:
 * - format: 'json' | 'csv' (default: 'json')
 *
 * Response:
 * - 200: Export data
 * - 401: Unauthorized
 * - 403: Forbidden (user doesn't own the session)
 * - 404: Session not found
 * - 429: Too Many Requests
 * - 500: Internal server error
 */
const getHandler = withAuth(async (
  request: NextRequest,
  firebaseUser,
  context: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: sessionId } = await context.params
    log('[API] Exporting session:', sessionId, 'user:', firebaseUser.uid)

    // Get the session and verify ownership
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: { firebaseUid: true }
        },
        uploadedFiles: {
          select: {
            id: true,
            fileName: true,
            originalName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
            dataSchema: true,
            // Note: parsedData excluded to reduce size, filePath/fileHash excluded for security
          },
          orderBy: { createdAt: 'asc' }
        },
        analyses: {
          include: {
            charts: {
              select: {
                id: true,
                type: true,
                title: true,
                description: true,
                dataKeys: true,
                config: true,
                position: true,
                isVisible: true,
                createdAt: true,
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        chatMessages: {
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' }
        },
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Verify the user owns this session
    if (session.user?.firebaseUid !== firebaseUser.uid) {
      log('[API] User does not own session:', sessionId)
      return NextResponse.json(
        { error: 'You do not have permission to export this session' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Safe JSON parse helper
    const safeJsonParse = <T>(value: string | null | undefined, fallback: T): T => {
      if (!value) return fallback
      try {
        return JSON.parse(value) as T
      } catch {
        return fallback
      }
    }

    // Format export data
    const exportData = {
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      files: session.uploadedFiles.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        dataSchema: safeJsonParse(file.dataSchema, null),
      })),
      analyses: session.analyses.map((analysis) => ({
        id: analysis.id,
        name: analysis.name,
        description: analysis.description,
        insights: safeJsonParse(analysis.insights, null),
        summary: safeJsonParse(analysis.summary, null),
        keyFindings: safeJsonParse(analysis.keyFindings, null),
        recommendations: safeJsonParse(analysis.recommendations, null),
        businessContext: analysis.businessContext,
        createdAt: analysis.createdAt,
        charts: analysis.charts.map((chart) => ({
          id: chart.id,
          type: chart.type,
          title: chart.title,
          description: chart.description,
          dataKeys: safeJsonParse(chart.dataKeys, null),
          config: safeJsonParse(chart.config, null),
          position: chart.position,
          isVisible: chart.isVisible,
          createdAt: chart.createdAt,
        })),
      })),
      chatHistory: session.chatMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        metadata: safeJsonParse(msg.metadata, null),
      })),
      exportedAt: new Date().toISOString(),
      exportFormat: format,
    }

    switch (format) {
      case 'json':
        log('[API] Exporting session as JSON:', sessionId)
        return NextResponse.json(exportData, {
          headers: {
            'Content-Disposition': `attachment; filename="session-${sessionId}-${Date.now()}.json"`,
            'Content-Type': 'application/json',
          },
        })

      case 'csv':
        // For CSV, export the chat history
        const csvRows = [
          ['Timestamp', 'Role', 'Content'],
          ...exportData.chatHistory.map((msg) => [
            msg.timestamp,
            msg.role,
            msg.content.replace(/"/g, '""'), // Escape quotes
          ]),
        ]

        const csvContent = csvRows
          .map((row) => row.map((cell) => `"${cell}"`).join(','))
          .join('\n')

        log('[API] Exporting session as CSV:', sessionId)
        return new NextResponse(csvContent, {
          headers: {
            'Content-Disposition': `attachment; filename="chat-history-${sessionId}-${Date.now()}.csv"`,
            'Content-Type': 'text/csv',
          },
        })

      default:
        return NextResponse.json(
          { error: 'Unsupported export format. Use "json" or "csv".' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[API] Error exporting session data:', error)
    return NextResponse.json(
      { error: 'Failed to export session data' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.AUTH, getHandler)
