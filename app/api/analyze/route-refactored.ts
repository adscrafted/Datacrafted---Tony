/**
 * Refactored Analysis API Route
 * Clean, maintainable API endpoint using service layer architecture
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, isAuthenticated } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'
import { analysisService, type AnalysisRequest } from '@/lib/services/analysis'
import { isTimeoutError } from '@/lib/utils/timeout'

// Production-ready logging
const logger = {
  info: console.log,
  error: console.error,
  debug: process.env.NODE_ENV === 'development' ? console.log : () => {}
}

/**
 * Main handler function
 */
const handler = withAuth(async (request: NextRequest, authUser) => {
  const requestStartTime = Date.now()

  logger.info('[API-ANALYZE] Request received:', {
    userId: authUser.uid,
    timestamp: new Date().toISOString()
  })

  try {
    // Parse request body
    const body = await request.json()
    const analysisRequest: AnalysisRequest = {
      data: body.data,
      schema: body.schema,
      correctedSchema: body.correctedSchema,
      feedback: body.feedback,
      fileName: body.fileName,
      useCache: body.useCache !== false,
      quickAnalysis: body.quickAnalysis === true
    }

    // Validate request
    const validation = analysisService.validateRequest(analysisRequest)
    if (!validation.valid) {
      logger.error('[API-ANALYZE] Invalid request:', validation.errors)
      return NextResponse.json(
        {
          error: 'Invalid request',
          errors: validation.errors
        },
        { status: 400 }
      )
    }

    // Perform analysis
    const result = await analysisService.analyze(analysisRequest)

    // Log success
    const duration = Date.now() - requestStartTime
    logger.info('[API-ANALYZE] Analysis completed:', {
      duration: `${duration}ms`,
      charts: result.chartConfig.length,
      cached: body.useCache !== false
    })

    return NextResponse.json(result)

  } catch (error) {
    const duration = Date.now() - requestStartTime
    logger.error('[API-ANALYZE] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`
    })

    // Handle specific error types
    if (isTimeoutError(error)) {
      return NextResponse.json(
        {
          error: 'Analysis request timed out',
          type: 'timeout',
          details: 'The analysis took too long to complete. Please try with a smaller dataset.'
        },
        { status: 408 }
      )
    }

    // Check for OpenAI-specific errors
    const errorMessage = error instanceof Error ? error.message : ''

    if (errorMessage.includes('Rate limit exceeded')) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          type: 'rate_limit',
          details: 'Please wait a moment and try again.'
        },
        { status: 429 }
      )
    }

    if (errorMessage.includes('quota exceeded')) {
      return NextResponse.json(
        {
          error: 'OpenAI quota exceeded',
          type: 'quota_exceeded',
          details: 'Please check your OpenAI billing.'
        },
        { status: 402 }
      )
    }

    // Generic error response
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Analysis failed',
        type: 'unknown_error',
        details: 'Please check your data format and try again'
      },
      { status: 500 }
    )
  }
})

// Apply rate limiting
export const POST = withRateLimit(RATE_LIMITS.ANALYSIS, handler)

// Export configuration
export const maxDuration = 300 // 5 minutes timeout
export const runtime = 'nodejs' // Node.js runtime for full API support