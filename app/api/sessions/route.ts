import { NextRequest, NextResponse } from 'next/server'
import { createSession, getRecentSessions, setSessionCookie } from '@/lib/session'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const postHandler = withAuth(async (request, authUser) => {
  try {
    const body = await request.json()
    const { name, description } = body

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
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
})

export const POST = withRateLimit(RATE_LIMITS.SESSION, postHandler)

const getHandler = withAuth(async (request, authUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // SECURITY: Only fetch sessions for the authenticated user
    // Never trust userId from query params
    const sessions = await getRecentSessions(authUser.uid, limit)

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
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)