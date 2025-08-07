import { NextRequest, NextResponse } from 'next/server'

interface MonitoringData {
  type: 'error' | 'performance' | 'event'
  data: any
}

export async function POST(request: NextRequest) {
  try {
    const body: MonitoringData = await request.json()
    
    // Rate limiting check
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    if (await isRateLimited(clientIP)) {
      return new NextResponse('Rate limited', { status: 429 })
    }
    
    // Process different types of monitoring data
    switch (body.type) {
      case 'error':
        await processErrorData(body.data)
        break
      case 'performance':
        await processPerformanceData(body.data)
        break
      case 'event':
        await processEventData(body.data)
        break
      default:
        return new NextResponse('Invalid monitoring type', { status: 400 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Monitoring endpoint error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

async function processErrorData(data: any) {
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('Client Error:', data)
    return
  }
  
  // In production, you would send to external monitoring service
  // Example integrations:
  
  // 1. Send to Sentry (when installed)
  // Uncomment when Sentry is installed: npm install @sentry/nextjs
  /*
  if (process.env.SENTRY_DSN) {
    try {
      const { captureException } = await import('@sentry/nextjs')
      captureException(new Error(data.message), {
        extra: data,
        tags: {
          component: data.component,
          action: data.action
        }
      })
    } catch (error) {
      console.warn('Failed to send error to Sentry:', error)
    }
  }
  */
  
  // 2. Send to custom logging service
  // await sendToLogService('error', data)
  
  // 3. Store in database for analysis
  // await storeErrorInDB(data)
}

async function processPerformanceData(data: any) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Performance Metric:', data)
    return
  }
  
  // In production, send to analytics service
  // Examples:
  
  // 1. Send to Google Analytics
  if (process.env.GA_MEASUREMENT_ID) {
    try {
      await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`, {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'anonymous', // Use actual client ID in production
          events: [{
            name: 'performance_metric',
            parameters: {
              metric_name: data.name,
              metric_value: data.value,
              metric_unit: data.unit
            }
          }]
        })
      })
    } catch (error) {
      console.warn('Failed to send performance data to GA:', error)
    }
  }
  
  // 2. Send to DataDog, New Relic, etc.
  // await sendToAPM(data)
}

async function processEventData(data: any) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('User Event:', data)
    return
  }
  
  // Send to analytics platforms
  // Similar to performance data but for user interactions
}

// Simple in-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

async function isRateLimited(clientIP: string): Promise<boolean> {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 100 // Max 100 requests per minute per IP
  
  const clientData = rateLimitMap.get(clientIP)
  
  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientIP, {
      count: 1,
      resetTime: now + windowMs
    })
    return false
  }
  
  if (clientData.count >= maxRequests) {
    return true
  }
  
  clientData.count++
  return false
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  const entries = Array.from(rateLimitMap.entries())
  for (const [ip, data] of entries) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000) // Clean up every 5 minutes