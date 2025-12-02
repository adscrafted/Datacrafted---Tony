import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { validateRequest, updateDashboardConfigSchema } from '@/lib/utils/api-validation'

/**
 * GET /api/projects/[id]/config
 * Retrieves dashboard configuration for a project
 */
const getHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // First, get the database user
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // Verify project exists and user owns it
    const project = await db.projects.findFirst({
      where: {
        id: projectId,
        userId: dbUser.id
      }
    })

    if (!project) {
      // Return empty config for non-existent projects (allows local-only projects)
      return NextResponse.json({
        chartCustomizations: {},
        currentTheme: null,
        currentLayout: null,
        dashboardFilters: null,
        version: 1,
      })
    }

    // Use database user ID (CUID)
    const databaseUserId = dbUser.id

    // Get dashboard config
    const config = await db.dashboard_configs.findFirst({
      where: {
        projectId,
        userId: databaseUserId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    if (!config) {
      // Return empty config if none exists
      return NextResponse.json({
        chartCustomizations: {},
        currentTheme: null,
        currentLayout: null,
        dashboardFilters: null,
        version: 1,
      })
    }

    // Parse stored JSON data
    const chartCustomizations = config.chartCustomizations
      ? JSON.parse(config.chartCustomizations)
      : {}
    const currentTheme = config.currentTheme
      ? JSON.parse(config.currentTheme)
      : null
    const currentLayout = config.currentLayout
      ? JSON.parse(config.currentLayout)
      : null
    const dashboardFilters = config.dashboardFilters
      ? JSON.parse(config.dashboardFilters)
      : null
    const dateRange = config.dateRange
      ? JSON.parse(config.dateRange)
      : null
    const chatMessages = config.chatMessages
      ? JSON.parse(config.chatMessages)
      : []
    const granularity = config.granularity || null

    return NextResponse.json({
      chartCustomizations,
      currentTheme,
      currentLayout,
      dashboardFilters,
      dateRange,
      granularity,
      chatMessages,
      version: config.version,
      lastModified: config.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error fetching dashboard config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard config' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)

/**
 * PUT /api/projects/[id]/config
 * Saves dashboard configuration for a project
 */
const putHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // First, get the database user
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      )
    }

    // Verify project exists and user owns it
    const project = await db.projects.findFirst({
      where: {
        id: projectId,
        userId: dbUser.id
      }
    })

    if (!project) {
      // For local-only projects, just return success without saving
      return NextResponse.json({
        success: true,
        configId: null,
        message: 'Config not saved - project not in database',
      })
    }

    // Validate request body with Zod
    const validation = await validateRequest(request, updateDashboardConfigSchema)
    if (!validation.success) {
      return validation.response
    }

    const {
      chartCustomizations = {},
      currentTheme = null,
      currentLayout = null,
      dashboardFilters = null,
      dateRange = null,
      granularity = null,
      chatMessages = null,
    } = validation.data

    // Use database user ID (CUID)
    const databaseUserId = dbUser.id

    // Generate config ID (combination of database userId and projectId)
    const configId = `${databaseUserId}_${projectId}`

    // Upsert dashboard config
    const config = await db.dashboard_configs.upsert({
      where: { id: configId },
      create: {
        id: configId,
        userId: databaseUserId,
        projectId,
        chartCustomizations: JSON.stringify(chartCustomizations),
        currentTheme: currentTheme ? JSON.stringify(currentTheme) : null,
        currentLayout: currentLayout ? JSON.stringify(currentLayout) : null,
        dashboardFilters: dashboardFilters ? JSON.stringify(dashboardFilters) : null,
        dateRange: dateRange ? JSON.stringify(dateRange) : null,
        granularity: granularity || null,
        chatMessages: chatMessages ? JSON.stringify(chatMessages) : null,
        version: 1,
        updatedAt: new Date(),
      },
      update: {
        chartCustomizations: JSON.stringify(chartCustomizations),
        currentTheme: currentTheme ? JSON.stringify(currentTheme) : null,
        currentLayout: currentLayout ? JSON.stringify(currentLayout) : null,
        dashboardFilters: dashboardFilters ? JSON.stringify(dashboardFilters) : null,
        dateRange: dateRange ? JSON.stringify(dateRange) : null,
        granularity: granularity || null,
        chatMessages: chatMessages ? JSON.stringify(chatMessages) : null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      configId: config.id,
      lastModified: config.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error saving dashboard config:', error)
    return NextResponse.json(
      { error: 'Failed to save dashboard config' },
      { status: 500 }
    )
  }
})

export const PUT = withRateLimit(RATE_LIMITS.SESSION, putHandler)
