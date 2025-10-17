import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'

const getHandler = withAuth(async (request, authUser) => {
  try {
    console.log('[API PROJECTS] Fetching projects for user:', authUser.uid)

    // First, get the database user ID from Firebase UID
    const dbUser = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!dbUser) {
      console.log('[API PROJECTS] User not found in database')
      return NextResponse.json({ projects: [] })
    }

    // Fetch projects from the database for the authenticated user
    // PERFORMANCE: Limit to 100 most recent projects
    const projects = await db.projects.findMany({
      where: {
        userId: dbUser.id
      },
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
  } catch (error) {
    console.error('[API PROJECTS] Error fetching projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)

const postHandler = withAuth(async (request, authUser) => {
  try {
    const body = await request.json()
    const { name, description, color, icon, settings } = body

    console.log('[API PROJECTS] Creating project for user:', authUser.uid)

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
  } catch (error) {
    console.error('[API PROJECTS] Error creating project:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
})

export const POST = withRateLimit(RATE_LIMITS.SESSION, postHandler)
