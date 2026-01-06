import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'

const isDev = process.env.NODE_ENV === 'development'
const log = (...args: unknown[]) => { if (isDev) console.log(...args) }

/**
 * Safe JSON parse with fallback
 * Prevents crashes on malformed JSON data
 */
function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch (error) {
    console.warn('[API] Failed to parse JSON:', error)
    return fallback
  }
}

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
    log('[API] Exporting user data:', firebaseUser.uid)

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
                columnTypes: true,
                hasAnalysis: true,
                analysisData: true,
                chartCustomizations: true,
                status: true,
                dataQualityScore: true,
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
                    metadata: true,
                  },
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
            dashboard_configs: {
              select: {
                id: true,
                createdAt: true,
                chartCustomizations: true,
                currentTheme: true,
                currentLayout: true,
                dashboardFilters: true,
                dateRange: true,
                granularity: true,
              },
            },
          },
        },
        // Include sessions with all nested data (UploadedFiles, Analyses, Charts, ChatMessages)
        sessions: {
          include: {
            uploadedFiles: {
              select: {
                id: true,
                createdAt: true,
                fileName: true,
                originalName: true,
                fileSize: true,
                mimeType: true,
                // Note: fileHash and filePath intentionally excluded (internal server data)
                parsedData: true,
                dataSchema: true,
              },
            },
            analyses: {
              include: {
                charts: {
                  select: {
                    id: true,
                    createdAt: true,
                    type: true,
                    title: true,
                    description: true,
                    dataKeys: true,
                    config: true,
                    position: true,
                    isVisible: true,
                  },
                },
              },
            },
            chatMessages: {
              select: {
                id: true,
                createdAt: true,
                role: true,
                content: true,
                metadata: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        dashboard_configs: {
          select: {
            id: true,
            createdAt: true,
            chartCustomizations: true,
            currentTheme: true,
            currentLayout: true,
            dashboardFilters: true,
          },
        },
        // Include user's direct chat conversations (via userId field)
        chatConversations: {
          include: {
            messages: {
              select: {
                id: true,
                createdAt: true,
                role: true,
                content: true,
                metadata: true,
              },
              orderBy: { createdAt: 'asc' },
            },
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
      exportVersion: '2.0',
      account: {
        id: user.id,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      preferences: safeJsonParse(user.preferences, null),
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
          columns: safeJsonParse(data.columnNames, []),
          columnTypes: safeJsonParse(data.columnTypes, null),
          hasAnalysis: data.hasAnalysis,
          analysisData: safeJsonParse(data.analysisData, null),
          chartCustomizations: safeJsonParse(data.chartCustomizations, null),
          dataQualityScore: data.dataQualityScore,
          status: data.status,
          createdAt: data.createdAt,
        })),
        conversations: project.chatConversations.map((conv) => ({
          id: conv.id,
          name: conv.name,
          messageCount: conv.messageCount,
          createdAt: conv.createdAt,
          messages: conv.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            metadata: safeJsonParse(msg.metadata, null),
            createdAt: msg.createdAt,
          })),
        })),
        dashboardConfigs: project.dashboard_configs.map((config) => ({
          id: config.id,
          theme: config.currentTheme,
          layout: config.currentLayout,
          filters: safeJsonParse(config.dashboardFilters, null),
          dateRange: config.dateRange,
          granularity: config.granularity,
          createdAt: config.createdAt,
        })),
      })),
      // Sessions with full nested data (UploadedFiles, Analyses, Charts, ChatMessages)
      sessions: user.sessions.map((session) => ({
        id: session.id,
        name: session.name,
        description: session.description,
        isActive: session.isActive,
        createdAt: session.createdAt,
        // UploadedFile records with parsedData and dataSchema
        uploadedFiles: session.uploadedFiles.map((file) => ({
          id: file.id,
          fileName: file.fileName,
          originalName: file.originalName,
          fileSize: file.fileSize,
          mimeType: file.mimeType,
          parsedData: safeJsonParse(file.parsedData, null),
          dataSchema: safeJsonParse(file.dataSchema, null),
          createdAt: file.createdAt,
        })),
        // Analysis records with insights, summary, keyFindings, recommendations
        analyses: session.analyses.map((analysis) => ({
          id: analysis.id,
          name: analysis.name,
          description: analysis.description,
          insights: safeJsonParse(analysis.insights, null),
          summary: analysis.summary,
          keyFindings: safeJsonParse(analysis.keyFindings, null),
          recommendations: safeJsonParse(analysis.recommendations, null),
          businessContext: analysis.businessContext,
          fileId: analysis.fileId,
          createdAt: analysis.createdAt,
          // Chart records with configurations
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
        // Session-based ChatMessage records
        chatMessages: session.chatMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          metadata: safeJsonParse(msg.metadata, null),
          createdAt: msg.createdAt,
        })),
      })),
      // User-level dashboard configs
      dashboardConfigs: user.dashboard_configs.map((config) => ({
        id: config.id,
        theme: config.currentTheme,
        layout: config.currentLayout,
        filters: safeJsonParse(config.dashboardFilters, null),
        createdAt: config.createdAt,
      })),
      // User's direct ChatConversations (via userId field)
      chatConversations: user.chatConversations.map((conv) => ({
        id: conv.id,
        name: conv.name,
        projectId: conv.projectId,
        messageCount: conv.messageCount,
        isPinned: conv.isPinned,
        isActive: conv.isActive,
        lastMessageAt: conv.lastMessageAt,
        lastMessagePreview: conv.lastMessagePreview,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messages: conv.messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          metadata: safeJsonParse(msg.metadata, null),
          createdAt: msg.createdAt,
        })),
      })),
    }

    log('[API] User data exported successfully:', firebaseUser.uid)

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
