import { cookies } from 'next/headers'
import { db } from './db'

const SESSION_COOKIE_NAME = 'datacrafted-session'
const SESSION_EXPIRE_DAYS = parseInt(process.env.SESSION_EXPIRE_DAYS || '30')

export interface SessionData {
  id: string
  name: string | null
  description: string | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date | null
  userId: string | null
  isActive: boolean
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Create a new session
 */
export async function createSession(options: {
  name?: string
  description?: string
  userId?: string
}): Promise<SessionData> {
  const expiresAt = new Date(Date.now() + SESSION_EXPIRE_DAYS * 24 * 60 * 60 * 1000)
  
  const session = await db.session.create({
    data: {
      name: options.name,
      description: options.description,
      userId: options.userId,
      expiresAt,
    },
  })

  return session
}

/**
 * Get session from database
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const session = await db.session.findUnique({
    where: {
      id: sessionId,
      isActive: true,
    },
  })

  // Check if session is expired
  if (session && session.expiresAt && session.expiresAt < new Date()) {
    await db.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    })
    return null
  }

  return session
}

/**
 * Get current session from cookies
 */
export async function getCurrentSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionId) {
    return null
  }

  return getSession(sessionId)
}

/**
 * Set session cookie
 */
export async function setSessionCookie(sessionId: string) {
  const cookieStore = await cookies()
  const maxAge = SESSION_EXPIRE_DAYS * 24 * 60 * 60 // seconds

  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  })
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Update session metadata
 */
export async function updateSession(
  sessionId: string,
  updates: {
    name?: string
    description?: string
  }
): Promise<SessionData | null> {
  try {
    const session = await db.session.update({
      where: {
        id: sessionId,
        isActive: true,
      },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
    })

    return session
  } catch (error) {
    console.error('Error updating session:', error)
    return null
  }
}

/**
 * Get recent sessions for a user
 */
export async function getRecentSessions(userId?: string, limit = 10): Promise<SessionData[]> {
  const sessions = await db.session.findMany({
    where: {
      ...(userId ? { userId } : { userId: null }),
      isActive: true,
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: limit,
  })

  return sessions
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    await db.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    })
    return true
  } catch (error) {
    console.error('Error deleting session:', error)
    return false
  }
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.session.updateMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  })

  return result.count
}