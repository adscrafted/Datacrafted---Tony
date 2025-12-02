/**
 * Health Check Endpoint
 *
 * IMPORTANT: This endpoint must be FAST and SIMPLE
 * - No database calls (they might hang)
 * - No complex initialization
 * - Just return OK to prove the server is alive
 */

import { NextResponse } from 'next/server'

export async function GET() {
  // Simple health check - just prove the server is responding
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
}

// Also support HEAD requests for simpler health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
