import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'
import {
  parsePaginationParams,
  createPaginatedResponseFromQuery,
  getPrismaSkipTake,
  isPaginationRequested,
} from '@/lib/utils/pagination'
import { validateRequest, createProjectSchema } from '@/lib/utils/api-validation'
import { databaseError } from '@/lib/utils/api-errors'

const getHandler = withAuth(async (request, authUser) => {
  try {
    console.log('[API PROJECTS] Fetching projects for user:', authUser.uid)

    // Test database connection first
    try {
      await db.$queryRaw`SELECT 1`
      console.log('[API PROJECTS] Database connection successful')
    } catch (dbError: any) {
      console.error('[API PROJECTS] Database connection failed:', {
        message: dbError.message,
        code: dbError.code,
        meta: dbError.meta
      })

      // Return empty projects array on connection failure
      // This allows the frontend to fall back to local storage
      return NextResponse.json({
        projects: [],
        warning: 'Database temporarily unavailable'
      })
    }

    // First, get the database user ID from Firebase UID
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      console.log('[API PROJECTS] User not found in database')
      return NextResponse.json({ projects: [] })
    }

    // Parse pagination parameters from URL
    const { searchParams } = new URL(request.url)
    const paginationRequested = isPaginationRequested(searchParams)
    const paginationParams = parsePaginationParams(searchParams)

    // Base query filters
    const whereClause = {
      userId: dbUser.id
    }

    // If pagination is requested, get total count and paginated data
    if (paginationRequested) {
      // Get total count for pagination metadata
      const total = await db.projects.count({
        where: whereClause
      })

      // Calculate skip/take for database-level pagination
      const { skip, take } = getPrismaSkipTake(paginationParams)

      // Fetch paginated projects
      const projects = await db.projects.findMany({
        where: whereClause,
        orderBy: {
          updatedAt: 'desc'
        },
        skip,
        take,
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          icon: true,
          settings: true,
          userId: true,
          createdAt: true,
          updatedAt: true,
        }
      })

      console.log('[API PROJECTS] Found', projects.length, 'of', total, 'projects (page', paginationParams.page, ')')

      // Transform projects to match the frontend Project interface
      const transformedProjects = projects.map(project => {
        let settings = null
        try {
          settings = project.settings ? JSON.parse(project.settings) : null
        } catch (e) {
          console.error('[API PROJECTS] Failed to parse settings for project', project.id)
        }

        return {
          id: project.id,
          userId: authUser.uid, // Use Firebase UID instead of database user ID
          name: project.name,
          description: project.description || undefined,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          lastAccessedAt: project.updatedAt.toISOString(), // Use updatedAt as lastAccessed for now
          status: 'active' as const,
          color: project.color || undefined,
          icon: project.icon || undefined,
          fileInfo: settings?.fileInfo,
          tags: settings?.tags,
          dashboardConfig: settings?.dashboardConfig,
        }
      })

      // Return paginated response
      const paginatedResponse = createPaginatedResponseFromQuery(
        total,
        transformedProjects,
        paginationParams
      )

      return NextResponse.json(paginatedResponse)
    }

    // BACKWARD COMPATIBILITY: If no pagination params, return all projects (with limit)
    // PERFORMANCE: Limit to 100 most recent projects to prevent unbounded queries
    const projects = await db.projects.findMany({
      where: whereClause,
      orderBy: {
        updatedAt: 'desc'
      },
      take: 100, // Limit to prevent unbounded queries
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        icon: true,
        settings: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
      }
    })

    console.log('[API PROJECTS] Found', projects.length, 'projects')

    // Transform projects to match the frontend Project interface
    const transformedProjects = projects.map(project => {
      let settings = null
      try {
        settings = project.settings ? JSON.parse(project.settings) : null
      } catch (e) {
        console.error('[API PROJECTS] Failed to parse settings for project', project.id)
      }

      return {
        id: project.id,
        userId: authUser.uid, // Use Firebase UID instead of database user ID
        name: project.name,
        description: project.description || undefined,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        lastAccessedAt: project.updatedAt.toISOString(), // Use updatedAt as lastAccessed for now
        status: 'active' as const,
        color: project.color || undefined,
        icon: project.icon || undefined,
        fileInfo: settings?.fileInfo,
        tags: settings?.tags,
        dashboardConfig: settings?.dashboardConfig,
      }
    })

    return NextResponse.json({
      projects: transformedProjects
    })
  } catch (error: any) {
    console.error('[API PROJECTS] Error fetching projects:', error)

    // Check for specific database connection errors
    if (error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1008') {
      // Prisma connection errors - return empty array instead of 500 error
      console.error('[API PROJECTS] Database connection error, falling back to local storage')
      return NextResponse.json({
        projects: [],
        warning: 'Database connection error - using local storage'
      })
    }

    if (error.message?.includes('connect ECONNREFUSED') ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('Connection pool timeout')) {
      console.error('[API PROJECTS] Connection pool exhausted or database unreachable')
      return NextResponse.json({
        projects: [],
        warning: 'Database temporarily unavailable'
      })
    }

    // For other errors, return standard database error
    return databaseError('fetch projects', error)
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)

const postHandler = withAuth(async (request, authUser) => {
  try {
    console.log('[API PROJECTS] Creating project for user:', authUser.uid)

    // Test database connection first
    try {
      await db.$queryRaw`SELECT 1`
      console.log('[API PROJECTS] Database connection successful')
    } catch (dbError: any) {
      console.error('[API PROJECTS] Database connection failed during project creation:', {
        message: dbError.message,
        code: dbError.code
      })

      // Return error indicating database is unavailable
      // Frontend will fall back to local creation
      return NextResponse.json({
        error: 'Database temporarily unavailable',
        message: 'Project will be created locally'
      }, { status: 503 })
    }

    // Validate request body with Zod
    const validation = await validateRequest(request, createProjectSchema)
    if (!validation.success) {
      return validation.response
    }

    const { name, description, color, icon, settings } = validation.data

    // Get or create user in the database
    let dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      console.log('[API PROJECTS] User not found in database, creating...')
      dbUser = await db.user.create({
        data: {
          firebaseUid: authUser.uid,
          email: authUser.email || undefined,
          name: authUser.displayName || undefined,
          photoURL: authUser.photoURL || undefined,
        }
      })
    }

    // Create the project
    const project = await db.projects.create({
      data: {
        id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        description: description || null,
        color: color || null,
        icon: icon || null,
        settings: settings ? JSON.stringify(settings) : null,
        userId: dbUser.id,
        updatedAt: new Date(),
      }
    })

    console.log('[API PROJECTS] Project created:', project.id)

    return NextResponse.json({
      project: {
        id: project.id,
        userId: authUser.uid,
        name: project.name,
        description: project.description || undefined,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        lastAccessedAt: project.updatedAt.toISOString(),
        status: 'active' as const,
        color: project.color || undefined,
        icon: project.icon || undefined,
      }
    })
  } catch (error: any) {
    console.error('[API PROJECTS] Error creating project:', error)

    // Check for specific database connection errors
    if (error.code === 'P1001' || error.code === 'P1002' || error.code === 'P1008') {
      // Prisma connection errors - return 503 for frontend fallback
      console.error('[API PROJECTS] Database connection error during project creation')
      return NextResponse.json({
        error: 'Database connection error',
        message: 'Project will be created locally'
      }, { status: 503 })
    }

    if (error.message?.includes('connect ECONNREFUSED') ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('Connection pool timeout')) {
      console.error('[API PROJECTS] Connection pool exhausted during project creation')
      return NextResponse.json({
        error: 'Database temporarily unavailable',
        message: 'Project will be created locally'
      }, { status: 503 })
    }

    // For other errors, return standard database error
    return databaseError('create project', error)
  }
})

export const POST = withRateLimit(RATE_LIMITS.SESSION, postHandler)
