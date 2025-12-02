import { NextResponse } from 'next/server'

/**
 * Standardized API Error Response Utility
 *
 * This module provides consistent error responses across all API routes.
 * All error responses follow a standardized format with appropriate HTTP status codes.
 *
 * Error Response Format:
 * {
 *   error: string           // Human-readable error message
 *   code?: string          // Machine-readable error code for client-side handling
 *   details?: unknown      // Additional error details (validation errors, etc.)
 *   timestamp?: string     // ISO timestamp when error occurred
 * }
 *
 * Benefits:
 * - Consistent error format across all endpoints
 * - Type-safe error creation
 * - Prevents accidental exposure of sensitive information
 * - Easier client-side error handling
 * - Better debugging with optional timestamps
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Standard API error response structure
 */
export interface ApiError {
  error: string
  code?: string
  details?: unknown
  timestamp?: string
}

/**
 * Options for creating error responses
 */
export interface ErrorOptions {
  code?: string
  details?: unknown
  includeTimestamp?: boolean
}

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * Standard error codes for client-side handling
 * These codes allow clients to handle specific error cases programmatically
 */
export const ERROR_CODES = {
  // Authentication & Authorization (4xx)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Validation Errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_JSON: 'INVALID_JSON',

  // Resource Errors (404)
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',

  // Business Logic Errors (400/409)
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Server Errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const

// ============================================================================
// CORE ERROR RESPONSE CREATOR
// ============================================================================

/**
 * Create a standardized error response
 *
 * @param message - Human-readable error message
 * @param status - HTTP status code
 * @param options - Optional error code, details, and timestamp flag
 * @returns NextResponse with standardized error format
 *
 * @example
 * ```ts
 * return createErrorResponse('Invalid email format', 400, {
 *   code: ERROR_CODES.VALIDATION_ERROR,
 *   details: { field: 'email' }
 * })
 * ```
 */
export function createErrorResponse(
  message: string,
  status: number,
  options: ErrorOptions = {}
): NextResponse<ApiError> {
  const { code, details, includeTimestamp = false } = options

  const errorBody: ApiError = {
    error: message,
    ...(code && { code }),
    ...(details !== undefined && { details }),
    ...(includeTimestamp && { timestamp: new Date().toISOString() }),
  }

  return NextResponse.json(errorBody, { status })
}

// ============================================================================
// 400 BAD REQUEST ERRORS
// ============================================================================

/**
 * Create a 400 Bad Request error response
 * Use for invalid input, validation failures, or malformed requests
 *
 * @param message - Description of what was invalid
 * @param details - Optional validation error details
 * @returns 400 Bad Request response
 *
 * @example
 * ```ts
 * return badRequest('Name is required')
 * return badRequest('Invalid request body', { errors: validationErrors })
 * ```
 */
export function badRequest(message: string, details?: unknown): NextResponse<ApiError> {
  return createErrorResponse(message, 400, {
    code: ERROR_CODES.VALIDATION_ERROR,
    details,
  })
}

/**
 * Create a validation error response with field details
 * Use for schema validation failures
 *
 * @param details - Validation error details (field errors, etc.)
 * @returns 400 Bad Request response
 */
export function validationError(details: unknown): NextResponse<ApiError> {
  return createErrorResponse('Invalid request body', 400, {
    code: ERROR_CODES.VALIDATION_ERROR,
    details,
  })
}

/**
 * Create an invalid JSON error response
 * Use when request body cannot be parsed as JSON
 *
 * @returns 400 Bad Request response
 */
export function invalidJson(): NextResponse<ApiError> {
  return createErrorResponse('Invalid JSON in request body', 400, {
    code: ERROR_CODES.INVALID_JSON,
  })
}

// ============================================================================
// 401 UNAUTHORIZED ERRORS
// ============================================================================

/**
 * Create a 401 Unauthorized error response
 * Use when authentication is required but missing or invalid
 *
 * @param message - Optional custom message
 * @returns 401 Unauthorized response
 *
 * @example
 * ```ts
 * return unauthorized()
 * return unauthorized('Session expired')
 * ```
 */
export function unauthorized(message?: string): NextResponse<ApiError> {
  return createErrorResponse(
    message || 'Authentication required',
    401,
    {
      code: ERROR_CODES.UNAUTHORIZED,
    }
  )
}

/**
 * Create an expired token error response
 * Use when authentication token has expired
 *
 * @returns 401 Unauthorized response
 */
export function tokenExpired(): NextResponse<ApiError> {
  return createErrorResponse('Authentication token has expired', 401, {
    code: ERROR_CODES.TOKEN_EXPIRED,
  })
}

/**
 * Create an invalid token error response
 * Use when authentication token is malformed or invalid
 *
 * @returns 401 Unauthorized response
 */
export function invalidToken(): NextResponse<ApiError> {
  return createErrorResponse('Invalid authentication token', 401, {
    code: ERROR_CODES.INVALID_TOKEN,
  })
}

// ============================================================================
// 403 FORBIDDEN ERRORS
// ============================================================================

/**
 * Create a 403 Forbidden error response
 * Use when user is authenticated but lacks permission
 *
 * @param message - Optional custom message
 * @returns 403 Forbidden response
 *
 * @example
 * ```ts
 * return forbidden()
 * return forbidden('You do not have access to this project')
 * ```
 */
export function forbidden(message?: string): NextResponse<ApiError> {
  return createErrorResponse(
    message || 'You do not have permission to access this resource',
    403,
    {
      code: ERROR_CODES.FORBIDDEN,
    }
  )
}

// ============================================================================
// 404 NOT FOUND ERRORS
// ============================================================================

/**
 * Create a 404 Not Found error response
 * Use when a requested resource does not exist
 *
 * @param resource - Optional resource type (e.g., 'Project', 'User')
 * @returns 404 Not Found response
 *
 * @example
 * ```ts
 * return notFound()
 * return notFound('Project')
 * // Returns: { error: 'Project not found' }
 * ```
 */
export function notFound(resource?: string): NextResponse<ApiError> {
  const message = resource ? `${resource} not found` : 'Resource not found'
  return createErrorResponse(message, 404, {
    code: ERROR_CODES.NOT_FOUND,
  })
}

/**
 * Create a user not found error response
 * @returns 404 Not Found response
 */
export function userNotFound(): NextResponse<ApiError> {
  return createErrorResponse('User not found', 404, {
    code: ERROR_CODES.USER_NOT_FOUND,
  })
}

/**
 * Create a project not found error response
 * @returns 404 Not Found response
 */
export function projectNotFound(): NextResponse<ApiError> {
  return createErrorResponse('Project not found', 404, {
    code: ERROR_CODES.PROJECT_NOT_FOUND,
  })
}

/**
 * Create a session not found error response
 * @returns 404 Not Found response
 */
export function sessionNotFound(): NextResponse<ApiError> {
  return createErrorResponse('Session not found', 404, {
    code: ERROR_CODES.SESSION_NOT_FOUND,
  })
}

// ============================================================================
// 409 CONFLICT ERRORS
// ============================================================================

/**
 * Create a 409 Conflict error response
 * Use when a resource already exists or there's a state conflict
 *
 * @param message - Description of the conflict
 * @returns 409 Conflict response
 *
 * @example
 * ```ts
 * return conflict('A project with this name already exists')
 * ```
 */
export function conflict(message: string): NextResponse<ApiError> {
  return createErrorResponse(message, 409, {
    code: ERROR_CODES.RESOURCE_CONFLICT,
  })
}

// ============================================================================
// 429 RATE LIMIT ERRORS
// ============================================================================

/**
 * Create a 429 Too Many Requests error response
 * Use when rate limit is exceeded
 *
 * @param retryAfter - Optional seconds until retry is allowed
 * @returns 429 Too Many Requests response
 */
export function rateLimitExceeded(retryAfter?: number): NextResponse<ApiError> {
  const response = createErrorResponse('Rate limit exceeded', 429, {
    code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
    ...(retryAfter && { details: { retryAfter } }),
  })

  // Add Retry-After header if provided
  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString())
  }

  return response
}

// ============================================================================
// 500 INTERNAL SERVER ERRORS
// ============================================================================

/**
 * Create a 500 Internal Server Error response
 * Use for unexpected errors and exception handling
 *
 * SECURITY NOTE: Never expose internal error details in production
 * The error parameter is logged but not included in the response
 *
 * @param message - Generic error message for the client
 * @param error - Optional error object for server-side logging
 * @returns 500 Internal Server Error response
 *
 * @example
 * ```ts
 * try {
 *   // ... operation
 * } catch (error) {
 *   console.error('Operation failed:', error)
 *   return serverError('Failed to process request', error)
 * }
 * ```
 */
export function serverError(
  message?: string,
  error?: Error | unknown
): NextResponse<ApiError> {
  // Log the actual error for debugging (server-side only)
  if (error) {
    console.error('[API ERROR]', error)
  }

  // SECURITY: Never expose internal error details to clients
  // Only send a generic message
  return createErrorResponse(
    message || 'An unexpected error occurred',
    500,
    {
      code: ERROR_CODES.INTERNAL_ERROR,
      includeTimestamp: true, // Include timestamp for debugging
    }
  )
}

/**
 * Create a database error response
 * Use for database operation failures
 *
 * @param operation - The operation that failed (e.g., 'fetch user', 'create project')
 * @param error - Optional error object for logging
 * @returns 500 Internal Server Error response
 */
export function databaseError(
  operation: string,
  error?: Error | unknown
): NextResponse<ApiError> {
  if (error) {
    console.error(`[DATABASE ERROR] Failed to ${operation}:`, error)
  }

  return createErrorResponse(
    `Failed to ${operation}`,
    500,
    {
      code: ERROR_CODES.DATABASE_ERROR,
      includeTimestamp: true,
    }
  )
}

/**
 * Create an external service error response
 * Use when a third-party service fails
 *
 * @param service - Name of the service that failed
 * @param error - Optional error object for logging
 * @returns 500 Internal Server Error response
 */
export function externalServiceError(
  service: string,
  error?: Error | unknown
): NextResponse<ApiError> {
  if (error) {
    console.error(`[EXTERNAL SERVICE ERROR] ${service} failed:`, error)
  }

  return createErrorResponse(
    `External service unavailable`,
    500,
    {
      code: ERROR_CODES.EXTERNAL_SERVICE_ERROR,
      includeTimestamp: true,
    }
  )
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a response is an error response
 * Useful for conditional error handling
 *
 * @param response - NextResponse to check
 * @returns true if response status is 4xx or 5xx
 */
export function isErrorResponse(response: NextResponse): boolean {
  return response.status >= 400
}

/**
 * Extract error message from an unknown error object
 * Safely handles Error objects, strings, and unknown types
 *
 * @param error - Error of unknown type
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}
