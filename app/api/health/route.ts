/**
 * Health Check Endpoint
 *
 * SECURITY: This endpoint returns minimal information to prevent information disclosure.
 * Detailed health information is only logged internally, not exposed publicly.
 *
 * Public endpoint: Returns generic health status
 * Private details: Logged to console for monitoring systems
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`

    // Check environment variables (don't expose which ones are missing)
    const requiredEnvVars = ['OPENAI_API_KEY', 'DATABASE_URL']
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
    const allEnvVarsPresent = missingEnvVars.length === 0

    // SECURITY: Log internally but don't expose details publicly
    if (!allEnvVarsPresent) {
      console.error('[HEALTH] Missing required environment variables:', missingEnvVars)
      console.error('[HEALTH] Application configuration is incomplete')

      // Return generic unhealthy status without exposing details
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString()
          // SECURITY: Don't expose which checks failed or what's missing
        },
        { status: 503 }
      )
    }

    // Log success internally
    console.log('[HEALTH] All systems healthy')

    // SECURITY: Return minimal information publicly
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
      // SECURITY: Don't expose:
      // - Environment (development/production)
      // - Version numbers
      // - Which services are configured
      // - Internal system details
    })
  } catch (error) {
    // SECURITY: Log detailed error internally
    console.error('[HEALTH] Health check failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })

    // SECURITY: Return generic error to public
    // Don't expose error details, database connection strings, or internal info
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString()
        // SECURITY: Don't expose error details or which component failed
      },
      { status: 503 }
    )
  }
}