import { NextRequest, NextResponse } from 'next/server'
import { createSession, setSessionCookie } from '@/lib/session'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { db } from '@/lib/db'
import {
  parsePaginationParams,
  createPaginatedResponseFromQuery,
  getPrismaSkipTake,
  isPaginationRequested,
} from '@/lib/utils/pagination'
import { validateRequest, createSessionSchema } from '@/lib/utils/api-validation'
import { databaseError } from '@/lib/utils/api-errors'

const postHandler = withAuth(async (request, authUser) => {
  try {
    // Validate request body with Zod
    const validation = await validateRequest(request, createSessionSchema)
    if (!validation.success) {
      return validation.response
    }

    const { name, description } = validation.data

    // Create new session using authenticated user's ID
    // SECURITY: Never trust userId from request body - use authUser.uid instead
    const session = await createSession({
      name,
      description,
      userId: authUser.uid,
    })

    // Set session cookie
    await setSessionCookie(session.id)

    return NextResponse.json({
      session: {
        id: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error creating session:', error)
    return databaseError('create session', error)
  }
})

export const POST = withRateLimit(RATE_LIMITS.SESSION, postHandler)

const getHandler = withAuth(async (request, authUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const paginationRequested = isPaginationRequested(searchParams)

    // If pagination is requested, use new pagination logic
    if (paginationRequested) {
      const paginationParams = parsePaginationParams(searchParams)

      // Base query filters
      const whereClause = {
        userId: authUser.uid,
        isActive: true,
      }

      // Get total count for pagination metadata
      const total = await db.session.count({
        where: whereClause
      })

      // Calculate skip/take for database-level pagination
      const { skip, take } = getPrismaSkipTake(paginationParams)

      // Fetch paginated sessions
      const sessions = await db.session.findMany({
        where: whereClause,
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take,
      })

      // Transform sessions
      const transformedSessions = sessions.map((session) => ({
        id: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }))

      // Return paginated response
      const paginatedResponse = createPaginatedResponseFromQuery(
        total,
        transformedSessions,
        paginationParams
      )

      return NextResponse.json(paginatedResponse)
    }

    // BACKWARD COMPATIBILITY: Support legacy 'limit' parameter
    // This maintains compatibility with existing clients
    const limit = parseInt(searchParams.get('limit') || '10')

    // SECURITY: Only fetch sessions for the authenticated user
    // Never trust userId from query params
    const sessions = await db.session.findMany({
      where: {
        userId: authUser.uid,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    })

    return NextResponse.json({
      sessions: sessions.map((session) => ({
        id: session.id,
        name: session.name,
        description: session.description,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return databaseError('fetch sessions', error)
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)