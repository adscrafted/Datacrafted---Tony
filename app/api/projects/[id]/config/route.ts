import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

/**
 * GET /api/projects/[id]/config
 * Retrieves dashboard configuration for a project
 */
const getHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // Verify project exists and user has access
    const project = await db.projects.findUnique({
      where: { id: projectId },
      include: {
        users: {
          select: { firebaseUid: true, id: true }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // AUTHORIZATION: Verify user owns this project
    // Compare Firebase UID to Firebase UID (not database CUID)
    if (project.users.firebaseUid !== authUser.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get dashboard config
    const config = await db.dashboard_configs.findFirst({
      where: {
        projectId,
        userId: authUser.uid,
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

    return NextResponse.json({
      chartCustomizations,
      currentTheme,
      currentLayout,
      dashboardFilters,
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

    // Verify project exists and user has access
    const project = await db.projects.findUnique({
      where: { id: projectId },
      include: {
        users: {
          select: { firebaseUid: true, id: true }
        }
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // AUTHORIZATION: Verify user owns this project
    // Compare Firebase UID to Firebase UID (not database CUID)
    if (project.users.firebaseUid !== authUser.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const {
      chartCustomizations = {},
      currentTheme = null,
      currentLayout = null,
      dashboardFilters = null,
    } = body

    // Generate config ID (combination of userId and projectId)
    const configId = `${authUser.uid}_${projectId}`

    // Upsert dashboard config
    const config = await db.dashboard_configs.upsert({
      where: { id: configId },
      create: {
        id: configId,
        userId: authUser.uid,
        projectId,
        chartCustomizations: JSON.stringify(chartCustomizations),
        currentTheme: currentTheme ? JSON.stringify(currentTheme) : null,
        currentLayout: currentLayout ? JSON.stringify(currentLayout) : null,
        dashboardFilters: dashboardFilters ? JSON.stringify(dashboardFilters) : null,
        version: 1,
        updatedAt: new Date(),
      },
      update: {
        chartCustomizations: JSON.stringify(chartCustomizations),
        currentTheme: currentTheme ? JSON.stringify(currentTheme) : null,
        currentLayout: currentLayout ? JSON.stringify(currentLayout) : null,
        dashboardFilters: dashboardFilters ? JSON.stringify(dashboardFilters) : null,
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
