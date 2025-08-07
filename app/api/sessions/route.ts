import { NextRequest, NextResponse } from 'next/server'
import { createSession, getRecentSessions, setSessionCookie } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, userId } = body

    // Create new session
    const session = await createSession({
      name,
      description,
      userId,
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
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '10')

    const sessions = await getRecentSessions(userId || undefined, limit)

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
}