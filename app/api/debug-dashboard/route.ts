import { NextResponse } from 'next/server'

export async function GET() {
  // Simple debugging endpoint to verify server is working
  console.log('🔍 [DEBUG-API] Dashboard debug endpoint called')
  
  return NextResponse.json({
    status: 'Dashboard debug endpoint working',
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasOpenAI: !!process.env.OPENAI_API_KEY
    }
  })
}