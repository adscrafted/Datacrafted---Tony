/**
 * Standardized API Response Utilities
 *
 * Provides consistent error handling and response formatting across all API routes.
 * Includes proper HTTP status codes, error types, and logging integration.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Production-ready logging utility
 */
const isDevelopment = process.env.NODE_ENV === 'development'
const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment) console.log('[API-DEBUG]', ...args)
  },
  info: (...args: any[]) => {
    console.log('[API-INFO]', ...args)
  },
  warn: (...args: any[]) => {
    console.warn('[API-WARN]', ...args)
  },
  error: (...args: any[]) => {
    console.error('[API-ERROR]', ...args)
  }
}

/**
 * Custom API Error class with status code and additional details
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public details?: any,
    public errorType?: string
  ) {
    super(message)
    this.name = 'ApiError'
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Predefined API Error types for common scenarios
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(400, message, details, 'VALIDATION_ERROR')
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required', details?: any) {
    super(401, message, details, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions', details?: any) {
    super(403, message, details, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource', details?: any) {
    super(404, `${resource} not found`, details, 'NOT_FOUND_ERROR')
  }
}

export class ConflictError extends ApiError {
  constructor(message: string, details?: any) {
    super(409, message, details, 'CONFLICT_ERROR')
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(429, message, details, 'RATE_LIMIT_ERROR')
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(500, message, details, 'INTERNAL_SERVER_ERROR')
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service temporarily unavailable', details?: any) {
    super(503, message, details, 'SERVICE_UNAVAILABLE_ERROR')
  }
}

/**
 * Success response helper
 * Returns a standardized success response with data
 */
export function successResponse<T>(
  data: T,
  status: number = 200,
  metadata?: {
    message?: string
    timestamp?: string
    requestId?: string
  }
): NextResponse {
  const response = {
    success: true,
    data,
    ...(metadata?.message && { message: metadata.message }),
    ...(metadata?.timestamp && { timestamp: metadata.timestamp }),
    ...(metadata?.requestId && { requestId: metadata.requestId })
  }

  return NextResponse.json(response, { status })
}

/**
 * Error response helper
 * Returns a standardized error response based on error type
 */
export function errorResponse(
  error: unknown,
  fallbackMessage: string = 'An unexpected error occurred',
  requestId?: string
): NextResponse {
  // Handle ApiError instances
  if (error instanceof ApiError) {
    const response = {
      success: false,
      error: error.message,
      errorType: error.errorType,
      ...(error.details && { details: error.details }),
      ...(requestId && { requestId })
    }

    logger.error('API Error:', {
      type: error.errorType,
      status: error.statusCode,
      message: error.message,
      details: error.details,
      requestId
    })

    return NextResponse.json(response, { status: error.statusCode })
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))

    const response = {
      success: false,
      error: 'Validation failed',
      errorType: 'VALIDATION_ERROR',
      details: formattedErrors,
      ...(requestId && { requestId })
    }

    logger.warn('Validation Error:', {
      errors: formattedErrors,
      requestId
    })

    return NextResponse.json(response, { status: 400 })
  }

  // Handle standard JavaScript errors
  if (error instanceof Error) {
    logger.error('Unexpected Error:', {
      message: error.message,
      stack: error.stack,
      requestId
    })

    const response = {
      success: false,
      error: isDevelopment ? error.message : fallbackMessage,
      errorType: 'INTERNAL_SERVER_ERROR',
      ...(isDevelopment && error.stack && { stack: error.stack }),
      ...(requestId && { requestId })
    }

    return NextResponse.json(response, { status: 500 })
  }

  // Handle unknown errors
  logger.error('Unknown Error:', {
    error,
    requestId
  })

  const response = {
    success: false,
    error: fallbackMessage,
    errorType: 'UNKNOWN_ERROR',
    ...(requestId && { requestId })
  }

  return NextResponse.json(response, { status: 500 })
}

/**
 * Async error handler wrapper
 * Wraps async route handlers with automatic error handling
 */
export function withErrorHandler<P = any>(
  handler: (
    request: Request,
    context?: { params: P }
  ) => Promise<Response | NextResponse>
): (
  request: Request,
  context?: { params: P }
) => Promise<Response | NextResponse> {
  return async (request: Request, context?: { params: P }) => {
    const requestId = crypto.randomUUID()

    try {
      const response = await handler(request, context)
      return response
    } catch (error) {
      return errorResponse(error, 'An error occurred processing your request', requestId)
    }
  }
}

/**
 * Format Zod validation errors for better readability
 */
export function formatZodError(error: z.ZodError): {
  field: string
  message: string
  code: string
}[] {
  return error.errors.map(err => ({
    field: err.path.join('.') || 'root',
    message: err.message,
    code: err.code
  }))
}

/**
 * Paginated response helper
 * Returns a standardized paginated response
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  },
  status: number = 200
): NextResponse {
  const response = {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.page < pagination.totalPages,
      hasPreviousPage: pagination.page > 1
    }
  }

  return NextResponse.json(response, { status })
}

/**
 * No content response helper
 * Returns a 204 No Content response
 */
export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Created response helper
 * Returns a 201 Created response with location header
 */
export function createdResponse<T>(
  data: T,
  location?: string
): NextResponse {
  const response = NextResponse.json(
    {
      success: true,
      data
    },
    { status: 201 }
  )

  if (location) {
    response.headers.set('Location', location)
  }

  return response
}

/**
 * Accepted response helper
 * Returns a 202 Accepted response for async operations
 */
export function acceptedResponse(
  message: string = 'Request accepted for processing',
  jobId?: string
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      message,
      ...(jobId && { jobId })
    },
    { status: 202 }
  )
}

/**
 * Partial content response helper
 * Returns a 206 Partial Content response
 */
export function partialContentResponse<T>(
  data: T,
  range: {
    start: number
    end: number
    total: number
  }
): NextResponse {
  const response = NextResponse.json(
    {
      success: true,
      data
    },
    { status: 206 }
  )

  response.headers.set(
    'Content-Range',
    `items ${range.start}-${range.end}/${range.total}`
  )

  return response
}

/**
 * Export logger for use in API routes
 */
export { logger }
