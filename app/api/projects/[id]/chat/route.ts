import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

// GET /api/projects/[id]/chat
// Loads all chat messages for the project's auto-conversation
const getHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // Get user from database
    const user = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify project ownership
    const project = await db.projects.findFirst({
      where: {
        id: projectId,
        userId: user.id
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Find or create the auto-conversation for this project
    let conversation = await db.chatConversation.findFirst({
      where: {
        projectId,
        userId: user.id,
        isActive: true
      },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    })

    // If no conversation exists, create one automatically
    if (!conversation) {
      conversation = await db.chatConversation.create({
        data: {
          projectId,
          userId: user.id,
          name: `${project.name} Chat`,
          isActive: true,
          messageCount: 0
        },
        include: {
          messages: {
            orderBy: {
              createdAt: 'asc'
            }
          }
        }
      })
    }

    // Transform messages to match frontend format
    const messages = conversation.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
      metadata: msg.metadata ? JSON.parse(msg.metadata) : undefined
    }))

    return NextResponse.json({
      messages,
      conversationId: conversation.id,
      messageCount: conversation.messageCount
    })

  } catch (error) {
    console.error('[API CHAT] Error loading messages:', error)
    return NextResponse.json(
      { error: 'Failed to load chat messages' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)

// POST /api/projects/[id]/chat
// Adds a message to the project's auto-conversation
const postHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // Get user from database
    const user = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify project ownership
    const project = await db.projects.findFirst({
      where: {
        id: projectId,
        userId: user.id
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { role, content, metadata } = body

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: role and content' },
        { status: 400 }
      )
    }

    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "user" or "assistant"' },
        { status: 400 }
      )
    }

    // Find or create the auto-conversation for this project
    let conversation = await db.chatConversation.findFirst({
      where: {
        projectId,
        userId: user.id,
        isActive: true
      }
    })

    if (!conversation) {
      conversation = await db.chatConversation.create({
        data: {
          projectId,
          userId: user.id,
          name: `${project.name} Chat`,
          isActive: true,
          messageCount: 0
        }
      })
    }

    // Create the message
    const message = await db.chatConversationMessage.create({
      data: {
        conversationId: conversation.id,
        role,
        content,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    })

    // Update conversation metadata
    await db.chatConversation.update({
      where: { id: conversation.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageAt: message.createdAt,
        lastMessagePreview: content.substring(0, 100),
        updatedAt: new Date()
      }
    })

    // Return the created message in frontend format
    return NextResponse.json({
      message: {
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.createdAt.toISOString(),
        metadata: metadata || undefined
      }
    })

  } catch (error) {
    console.error('[API CHAT] Error saving message:', error)
    return NextResponse.json(
      { error: 'Failed to save chat message' },
      { status: 500 }
    )
  }
})

export const POST = withRateLimit(RATE_LIMITS.SESSION, postHandler)

// DELETE /api/projects/[id]/chat
// Clears all chat history for the project
const deleteHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: projectId } = await context!.params

    // Get user from database
    const user = await db.user.findUnique({
      where: { firebaseUid: authUser.uid }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify project ownership
    const project = await db.projects.findFirst({
      where: {
        id: projectId,
        userId: user.id
      }
    })

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // Find the conversation
    const conversation = await db.chatConversation.findFirst({
      where: {
        projectId,
        userId: user.id,
        isActive: true
      }
    })

    if (conversation) {
      // Delete all messages (cascade will handle this, but being explicit)
      await db.chatConversationMessage.deleteMany({
        where: {
          conversationId: conversation.id
        }
      })

      // Delete the conversation
      await db.chatConversation.delete({
        where: { id: conversation.id }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Chat history cleared'
    })

  } catch (error) {
    console.error('[API CHAT] Error clearing chat:', error)
    return NextResponse.json(
      { error: 'Failed to clear chat history' },
      { status: 500 }
    )
  }
})

export const DELETE = withRateLimit(RATE_LIMITS.SESSION, deleteHandler)
