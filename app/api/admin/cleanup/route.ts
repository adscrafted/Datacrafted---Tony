import { NextRequest, NextResponse } from 'next/server'
import { runFullCleanup, getDatabaseStats } from '@/lib/cleanup'

export async function POST(request: NextRequest) {
  try {
    console.log('Manual cleanup triggered via API')
    const stats = await runFullCleanup()
    
    return NextResponse.json({
      success: true,
      stats,
      message: 'Cleanup completed successfully',
    })
  } catch (error) {
    console.error('Cleanup API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const stats = await getDatabaseStats()
    
    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('Database stats API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get database stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}