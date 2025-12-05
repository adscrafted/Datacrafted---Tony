/**
 * Health Check Endpoint
 *
 * IMPORTANT: This endpoint must be FAST and SIMPLE
 * - No database calls (they might hang)
 * - No complex initialization
 * - Just return OK to prove the server is alive
 */

import { NextResponse } from 'next/server'
import { getAIProvider } from '@/lib/services/ai/ai-provider'

export async function GET() {
  const aiProvider = getAIProvider()

  // Simple health check - just prove the server is responding
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ai: {
      provider: aiProvider,
      model: aiProvider === 'gemini'
        ? (process.env.GEMINI_MODEL || 'gemini-2.0-flash')
        : 'gpt-4o-mini',
      configured: aiProvider === 'gemini'
        ? !!process.env.GOOGLE_GEMINI_API_KEY
        : !!process.env.OPENAI_API_KEY
    }
  })
}

// Also support HEAD requests for simpler health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
