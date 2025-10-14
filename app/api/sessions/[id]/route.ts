import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, deleteSession } from '@/lib/session'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const getHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id } = await context!.params
    const session = await getSession(id)

    if (!session) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      )
    }

    // AUTHORIZATION: Verify user owns this session
    if (session.userId !== authUser.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

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
    console.error('Error fetching session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)

const patchHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id } = await context!.params

    // AUTHORIZATION: Verify ownership before update
    const existingSession = await getSession(id)
    if (!existingSession) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      )
    }

    if (existingSession.userId !== authUser.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, description } = body

    const session = await updateSession(id, { name, description })

    if (!session) {
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      )
    }

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
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
})

export const PATCH = withRateLimit(RATE_LIMITS.SESSION, patchHandler)

const deleteHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id } = await context!.params

    // AUTHORIZATION: Verify ownership before deletion
    const existingSession = await getSession(id)
    if (!existingSession) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      )
    }

    if (existingSession.userId !== authUser.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const success = await deleteSession(id)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
})

export const DELETE = withRateLimit(RATE_LIMITS.SESSION, deleteHandler)