import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`
    
    // Check environment variables
    const requiredEnvVars = ['OPENAI_API_KEY', 'DATABASE_URL']
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])
    
    if (missingEnvVars.length > 0) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: {
            database: 'healthy',
            environment: 'unhealthy',
            missingEnvVars
          }
        },
        { status: 503 }
      )
    }

    // Check OpenAI API (optional - avoid rate limits in health checks)
    const openaiHealthy = process.env.OPENAI_API_KEY ? 'configured' : 'missing'

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: 'healthy',
        environment: 'healthy',
        openai: openaiHealthy
      }
    })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unhealthy',
          environment: 'unknown',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      { status: 503 }
    )
  }
}