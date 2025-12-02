/**
 * Session Management API
 *
 * Creates secure session cookies for authenticated users.
 * This endpoint is called after successful Firebase authentication
 * to set the __session cookie that middleware requires.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, DEBUG_MODE, DEBUG_USER } from '@/lib/config/firebase-admin'
import { cookies } from 'next/headers'
import { validateRequest, createAuthSessionSchema } from '@/lib/utils/api-validation'
import { serverError, invalidToken } from '@/lib/utils/api-errors'

export async function POST(request: NextRequest) {
  try {
    // Validate request body with Zod
    const validation = await validateRequest(request, createAuthSessionSchema)
    if (!validation.success) {
      return validation.response
    }

    const { idToken } = validation.data

    // In debug mode, accept any token and create debug session
    if (DEBUG_MODE) {
      console.log('[SESSION-API] Debug mode - creating debug session')

      const cookieStore = await cookies()
      cookieStore.set('__session', 'debug-session-token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 14, // 14 days
        path: '/',
      })

      return NextResponse.json({
        success: true,
        user: DEBUG_USER,
        debug: true,
      })
    }

    // Verify the ID token using Firebase Admin
    const adminAuth = getAdminAuth()
    const decodedToken = await adminAuth.verifyIdToken(idToken)

    // Create session cookie (expires in 14 days)
    const expiresIn = 60 * 60 * 24 * 14 * 1000 // 14 days in milliseconds
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    })

    // Set the session cookie
    const cookieStore = await cookies()
    cookieStore.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn / 1000, // maxAge is in seconds
      path: '/',
    })

    console.log('[SESSION-API] Session cookie created for user:', decodedToken.uid)

    return NextResponse.json({
      success: true,
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
      },
    })
  } catch (error) {
    console.error('[SESSION-API] Error creating session:', error)
    if (error instanceof Error && error.message.includes('token')) {
      return invalidToken()
    }
    return serverError('Failed to create session', error as Error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Clear the session cookie
    const cookieStore = await cookies()
    cookieStore.delete('__session')

    console.log('[SESSION-API] Session cookie cleared')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SESSION-API] Error clearing session:', error)
    return serverError('Failed to clear session', error as Error)
  }
}
