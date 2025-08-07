'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { getPerformanceReport, logPerformanceSummary } from '@/lib/utils/performance-monitor'
import { logger } from '@/lib/utils/logger'
import { BarChart3, Zap, Clock, Database, TrendingUp, AlertCircle } from 'lucide-react'

interface PerformanceStats {
  avgRenderTime: number
  totalRenders: number
  memoryUsage: number
  dataProcessingTime: number
  optimizationScore: number
}

export function PerformanceDashboard() {
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return

    const updateStats = () => {
      const report = getPerformanceReport()
      
      // Calculate average render time
      const chartRenders = report.metrics.filter(m => m.name.includes('chart-data-processing'))
      const avgRenderTime = chartRenders.length > 0
        ? chartRenders.reduce((sum, m) => sum + (m.duration || 0), 0) / chartRenders.length
        : 0

      // Calculate memory usage
      const memoryUsage = report.memoryUsage
        ? (report.memoryUsage.usedJSHeapSize / 1024 / 1024)
        : 0

      // Calculate data processing time
      const dataProcessingMetrics = report.metrics.filter(m => m.name.includes('data-processing'))
      const dataProcessingTime = dataProcessingMetrics.length > 0
        ? dataProcessingMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / dataProcessingMetrics.length
        : 0

      // Calculate optimization score (0-100)
      let score = 100
      if (avgRenderTime > 100) score -= 20
      if (avgRenderTime > 200) score -= 20
      if (memoryUsage > 100) score -= 20
      if (dataProcessingTime > 500) score -= 20

      setStats({
        avgRenderTime,
        totalRenders: chartRenders.length,
        memoryUsage,
        dataProcessingTime,
        optimizationScore: Math.max(0, score)
      })

      // Log summary to console
      logPerformanceSummary()
    }

    // Update stats every 5 seconds
    const interval = setInterval(updateStats, 5000)
    updateStats()

    // Add keyboard shortcut (Ctrl+Shift+P)
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyPress)

    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  if (!isVisible || !stats) return null

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    return 'Needs Improvement'
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">Performance Monitor</CardTitle>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
          <CardDescription>Press Ctrl+Shift+P to toggle</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Optimization Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Optimization Score</span>
              <Badge className={getScoreColor(stats.optimizationScore)}>
                {getScoreBadge(stats.optimizationScore)}
              </Badge>
            </div>
            <Progress value={stats.optimizationScore} className="h-2" />
            <p className={`text-2xl font-bold ${getScoreColor(stats.optimizationScore)}`}>
              {stats.optimizationScore}%
            </p>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-500">Avg Render Time</span>
              </div>
              <p className="text-lg font-semibold">
                {stats.avgRenderTime.toFixed(1)}ms
              </p>
              {stats.avgRenderTime > 100 && (
                <p className="text-xs text-amber-600">Consider optimization</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-500">Total Renders</span>
              </div>
              <p className="text-lg font-semibold">{stats.totalRenders}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-500">Memory Usage</span>
              </div>
              <p className="text-lg font-semibold">
                {stats.memoryUsage.toFixed(1)}MB
              </p>
              {stats.memoryUsage > 100 && (
                <p className="text-xs text-amber-600">High memory usage</p>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-gray-500" />
                <span className="text-xs text-gray-500">Data Processing</span>
              </div>
              <p className="text-lg font-semibold">
                {stats.dataProcessingTime.toFixed(1)}ms
              </p>
            </div>
          </div>

          {/* Optimization Tips */}
          {stats.optimizationScore < 80 && (
            <div className="mt-3 p-2 bg-amber-50 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-medium mb-1">Optimization Tips:</p>
                  {stats.avgRenderTime > 100 && (
                    <p>• Enable data sampling for large datasets</p>
                  )}
                  {stats.memoryUsage > 100 && (
                    <p>• Consider paginating or virtualizing data</p>
                  )}
                  {stats.dataProcessingTime > 500 && (
                    <p>• Use web workers for heavy computations</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}