import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const session = await getSession(sessionId)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Get complete session data for export
    const sessionData = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        uploadedFiles: {
          include: {
            analyses: {
              include: {
                charts: true,
              },
            },
          },
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

    // Format export data
    const exportData = {
      session: {
        id: sessionData.id,
        name: sessionData.name,
        description: sessionData.description,
        createdAt: sessionData.createdAt,
        updatedAt: sessionData.updatedAt,
      },
      files: sessionData.uploadedFiles.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        originalName: file.originalName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        createdAt: file.createdAt,
        dataSchema: file.dataSchema ? JSON.parse(file.dataSchema) : null,
        // Note: parsedData is excluded to reduce size, can be included if needed
        analyses: file.analyses.map((analysis) => ({
          id: analysis.id,
          name: analysis.name,
          description: analysis.description,
          insights: JSON.parse(analysis.insights),
          summary: JSON.parse(analysis.summary),
          keyFindings: analysis.keyFindings,
          recommendations: analysis.recommendations,
          businessContext: analysis.businessContext,
          createdAt: analysis.createdAt,
          charts: analysis.charts.map((chart) => ({
            id: chart.id,
            type: chart.type,
            title: chart.title,
            description: chart.description,
            dataKeys: JSON.parse(chart.dataKeys),
            config: chart.config ? JSON.parse(chart.config) : null,
            position: chart.position,
            isVisible: chart.isVisible,
          })),
        })),
      })),
      chatHistory: sessionData.chatMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.createdAt.toISOString(),
        metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
      })),
      exportedAt: new Date().toISOString(),
      exportFormat: format,
    }

    switch (format) {
      case 'json':
        return NextResponse.json(exportData, {
          headers: {
            'Content-Disposition': `attachment; filename="dashboard-${sessionId}-${Date.now()}.json"`,
            'Content-Type': 'application/json',
          },
        })

      case 'csv':
        // For CSV, we'll export the chat history as CSV
        const csvRows = [
          ['Timestamp', 'Role', 'Content'],
          ...exportData.chatHistory.map((msg) => [
            msg.timestamp,
            msg.role,
            msg.content.replace(/"/g, '""'), // Escape quotes
          ]),
        ]
        
        const csvContent = csvRows
          .map((row) => row.map((cell) => `"${cell}"`).join(','))
          .join('\n')

        return new NextResponse(csvContent, {
          headers: {
            'Content-Disposition': `attachment; filename="chat-history-${sessionId}-${Date.now()}.csv"`,
            'Content-Type': 'text/csv',
          },
        })

      default:
        return NextResponse.json(
          { error: 'Unsupported export format' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error exporting session data:', error)
    return NextResponse.json(
      { error: 'Failed to export session data' },
      { status: 500 }
    )
  }
}