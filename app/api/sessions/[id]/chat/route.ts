import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const getHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: sessionId } = await context!.params
    const session = await getSession(sessionId)

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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const chatMessages = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      skip: offset,
      take: limit,
    })

    return NextResponse.json({
      messages: chatMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
      })),
    })
  } catch (error) {
    console.error('Error fetching chat messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch chat messages' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)

const postHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: sessionId } = await context!.params
    const session = await getSession(sessionId)

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

    const body = await request.json()
    const { role, content, metadata } = body

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      )
    }

    const chatMessage = await db.chatMessage.create({
      data: {
        role,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null,
        sessionId,
      },
    })

    return NextResponse.json({
      message: {
        id: chatMessage.id,
        role: chatMessage.role,
        content: chatMessage.content,
        timestamp: chatMessage.createdAt.toISOString(),
        metadata: chatMessage.metadata ? JSON.parse(chatMessage.metadata) : null,
      },
    })
  } catch (error) {
    console.error('Error saving chat message:', error)
    return NextResponse.json(
      { error: 'Failed to save chat message' },
      { status: 500 }
    )
  }
})

export const POST = withRateLimit(RATE_LIMITS.SESSION, postHandler)

const deleteHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: sessionId } = await context!.params
    const session = await getSession(sessionId)

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

    // Clear all chat messages for the session
    const result = await db.chatMessage.deleteMany({
      where: { sessionId },
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Error clearing chat history:', error)
    return NextResponse.json(
      { error: 'Failed to clear chat history' },
      { status: 500 }
    )
  }
})

export const DELETE = withRateLimit(RATE_LIMITS.SESSION, deleteHandler)