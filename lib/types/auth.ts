/**
 * Authentication Types
 *
 * TypeScript types for authentication and authorization in the application.
 * These types are used across both client and server components.
 */

import { NextRequest } from 'next/server'

/**
 * Authenticated user data extracted from Firebase ID token
 */
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  phoneNumber?: string | null
  customClaims?: Record<string, any>
}

/**
 * Extended Next.js request with authenticated user
 */
export interface AuthenticatedRequest extends NextRequest {
  user: AuthUser
}

/**
 * Route handler that requires authentication
 * Takes request and authenticated user, returns a Response
 * Next.js 15: params is now a Promise (not the Promise itself is optional, but params field is optional)
 */
export type AuthenticatedRouteHandler<P = any> = (
  request: NextRequest,
  user: AuthUser,
  context: { params: Promise<P> }
) => Promise<Response>

/**
 * Standard Next.js route handler with optional params
 */
export type RouteHandler<P = {}> = (
  request: NextRequest,
  context?: { params: P }
) => Promise<Response>

/**
 * Authentication error types
 */
export enum AuthErrorCode {
  NO_TOKEN = 'NO_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
}

/**
 * Authentication error class
 */
export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public statusCode: number = 401
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Token payload from Firebase ID token
 */
export interface TokenPayload {
  uid: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  phone_number?: string
  [key: string]: any
}

/**
 * Auth middleware configuration
 */
export interface AuthMiddlewareConfig {
  // Allow debug mode bypass
  allowDebugMode?: boolean
  // Custom error handler
  onError?: (error: AuthError) => Response
  // Required custom claims
  requiredClaims?: Record<string, any>
}
