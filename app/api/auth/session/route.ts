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

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token is required' },
        { status: 400 }
      )
    }

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
    return NextResponse.json(
      { error: 'Failed to create session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
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
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    )
  }
}
