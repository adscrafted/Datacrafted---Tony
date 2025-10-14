import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { saveUploadedFile, getUploadedFile } from '@/lib/file-storage'
import type { AnalysisResult, DataRow } from '@/lib/store'
import { withAuth } from '@/lib/middleware/auth'
import { withRateLimit, RATE_LIMITS } from '@/lib/middleware/rate-limit'

const getHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: sessionId } = await context!.params
    const session = await getSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      )
    }

    // AUTHORIZATION: Verify user owns this session
    if (session.userId !== authUser.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get session data including files, analyses, and charts
    const sessionData = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        uploadedFiles: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get most recent file
        },
        analyses: {
          include: {
            charts: {
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1, // Get most recent analysis
        },
        chatMessages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!sessionData) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Get file data if available
    let fileData = null
    if (sessionData.uploadedFiles.length > 0) {
      const file = await getUploadedFile(sessionData.uploadedFiles[0].id)
      fileData = file
    }

    // Format analysis data
    let analysisData = null
    if (sessionData.analyses.length > 0) {
      const analysis = sessionData.analyses[0]
      analysisData = {
        id: analysis.id,
        name: analysis.name,
        description: analysis.description,
        insights: JSON.parse(analysis.insights),
        summary: JSON.parse(analysis.summary),
        keyFindings: analysis.keyFindings,
        recommendations: analysis.recommendations,
        businessContext: analysis.businessContext,
        charts: analysis.charts.map(chart => ({
          id: chart.id,
          type: chart.type,
          title: chart.title,
          description: chart.description,
          dataKeys: JSON.parse(chart.dataKeys),
          config: chart.config ? JSON.parse(chart.config) : null,
          position: chart.position,
          isVisible: chart.isVisible,
        })),
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      }
    }

    return NextResponse.json({
      session: {
        id: sessionData.id,
        name: sessionData.name,
        description: sessionData.description,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
      },
      file: fileData,
      analysis: analysisData,
      chatMessages: sessionData.chatMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
      })),
    })
  } catch (error) {
    console.error('Error fetching session data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session data' },
      { status: 500 }
    )
  }
})

export const GET = withRateLimit(RATE_LIMITS.SESSION, getHandler)

const postHandler = withAuth(async (request, authUser, context) => {
  try {
    const { id: sessionId } = await context!.params
    const session = await getSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      )
    }

    // AUTHORIZATION: Verify user owns this session
    if (session.userId !== authUser.uid) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { type, data } = body

    switch (type) {
      case 'file':
        // Save uploaded file
        const { file, parsedData } = data
        const fileId = await saveUploadedFile(sessionId, file, parsedData)
        return NextResponse.json({ fileId })

      case 'analysis':
        // Save analysis results
        const { analysis, fileId: analysisFileId } = data as {
          analysis: AnalysisResult
          fileId: string
        }

        const savedAnalysis = await db.analysis.create({
          data: {
            name: analysis.summary.businessContext || 'Analysis',
            insights: JSON.stringify(analysis.insights),
            summary: JSON.stringify(analysis.summary),
            keyFindings: analysis.summary.keyFindings,
            recommendations: analysis.summary.recommendations,
            businessContext: analysis.summary.businessContext,
            sessionId,
            fileId: analysisFileId,
          },
        })

        // Save charts
        const charts = await Promise.all(
          analysis.chartConfig.map((chart, index) =>
            db.chart.create({
              data: {
                type: chart.type,
                title: chart.title,
                description: chart.description,
                dataKeys: JSON.stringify(chart.dataKey),
                position: index,
                analysisId: savedAnalysis.id,
              },
            })
          )
        )

        return NextResponse.json({
          analysisId: savedAnalysis.id,
          chartIds: charts.map(c => c.id),
        })

      default:
        return NextResponse.json(
          { error: 'Invalid data type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error saving session data:', error)
    return NextResponse.json(
      { error: 'Failed to save session data' },
      { status: 500 }
    )
  }
})

export const POST = withRateLimit(RATE_LIMITS.SESSION, postHandler)