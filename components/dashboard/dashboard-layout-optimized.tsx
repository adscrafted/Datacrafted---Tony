'use client'

import React, { useMemo, useCallback } from 'react'
import { Layout as GridLayout } from 'react-grid-layout'
import { cn } from '@/lib/utils/cn'
import { FixedGridLayout } from '@/components/ui/fixed-grid-layout'
import { LazyChartWrapper } from './chart-wrapper-lazy'
import { useDataStore, AnalysisResult, DataRow } from '@/lib/store'
import { logger } from '@/lib/utils/logger'

interface DashboardLayoutOptimizedProps {
  analysis: AnalysisResult
  data: DataRow[]
  className?: string
}

// Memoized chart component to prevent re-renders
const MemoizedChart = React.memo<{
  config: any
  index: number
  data: DataRow[]
}>(({ config, index, data }) => {
  const chartId = config.id || `chart-${index}`
  
  return (
    <div className="h-full w-full p-2">
      <LazyChartWrapper
        id={chartId}
        type={config.type}
        title={config.title}
        description={config.description}
        data={data}
        dataKey={config.dataKey}
      />
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.config === nextProps.config &&
    prevProps.index === nextProps.index &&
    prevProps.data === nextProps.data // Use referential equality since data is memoized upstream
  )
})

MemoizedChart.displayName = 'MemoizedChart'

export const DashboardLayoutOptimized = React.memo<DashboardLayoutOptimizedProps>(
  function DashboardLayoutOptimized({ analysis, data, className }) {
    const {
      currentLayout,
      chartCustomizations,
      isCustomizing,
      updateChartCustomization
    } = useDataStore()
    
    logger.debug('[DashboardLayoutOptimized] Rendering with:', {
      analysisCharts: analysis?.chartConfig?.length,
      dataLength: data?.length,
      hasData: !!data,
      hasAnalysis: !!analysis
    })

    // Memoize layout calculation
    const layout = useMemo(() => {
      logger.debug('[DashboardLayout] Calculating layout')
      const fixedLayout: GridLayout[] = []
      
      analysis.chartConfig.forEach((config, index) => {
        const chartId = config.id || `chart-${index}`
        
        // Check for saved positions first
        const layoutPosition = currentLayout.chartPositions[chartId]
        if (layoutPosition && isCustomizing) {
          fixedLayout.push({
            i: chartId,
            ...layoutPosition,
            minW: config.type === 'scorecard' ? 2 : 4,
            minH: config.type === 'scorecard' ? 2 : 3,
            maxW: 12,
            maxH: 10
          })
        } else if (config.type === 'scorecard') {
          // Scorecards: 4 per row
          const scorecardIndex = analysis.chartConfig.slice(0, index).filter(c => c.type === 'scorecard').length
          const col = scorecardIndex % 4
          const row = Math.floor(scorecardIndex / 4)
          
          fixedLayout.push({
            i: chartId,
            x: col * 3,
            y: row * 3,
            w: 3,
            h: 2,
            minW: 2,
            minH: 2,
            maxW: 12,
            maxH: 10
          })
        } else {
          // Regular charts: 2 per row (6 units wide each in a 12-unit grid)
          const regularChartsBeforeThis = analysis.chartConfig.slice(0, index).filter(c => c.type !== 'scorecard')
          const regularChartIndex = regularChartsBeforeThis.length
          const col = regularChartIndex % 2  // 0 or 1
          const row = Math.floor(regularChartIndex / 2)
          
          // Calculate Y position accounting for any scorecards above
          const scorecardsAbove = analysis.chartConfig.slice(0, index).filter(c => c.type === 'scorecard').length
          const scorecardRows = Math.ceil(scorecardsAbove / 4)
          const yOffset = scorecardRows * 3 // Each scorecard row takes 3 units height
          
          fixedLayout.push({
            i: chartId,
            x: col * 6,  // 0 for left column, 6 for right column
            y: yOffset + (row * 6), // Space charts further apart
            w: 6,        // Half width
            h: 5,        // Height
            minW: 4,
            minH: 3,
            maxW: 12,
            maxH: 10
          })
        }
      })
      
      return fixedLayout
    }, [analysis.chartConfig, currentLayout.chartPositions, isCustomizing])

    // Memoize chart elements
    const chartElements = useMemo(() => {
      logger.debug('[DashboardLayout] Creating chart elements')
      return analysis.chartConfig.map((config, index) => (
        <MemoizedChart
          key={config.id || `chart-${index}`}
          config={config}
          index={index}
          data={data}
        />
      ))
    }, [analysis.chartConfig, data])

    // Memoize layout change handler
    const handleLayoutChange = useCallback((newLayout: GridLayout[]) => {
      if (!isCustomizing) return
      
      newLayout.forEach(item => {
        updateChartCustomization(item.i, {
          position: {
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h
          }
        })
      })
    }, [isCustomizing, updateChartCustomization])

    // Don't render if no charts
    if (!analysis.chartConfig || analysis.chartConfig.length === 0) {
      return null
    }

    return (
      <div className={cn("w-full", className)}>
        <FixedGridLayout
          layout={layout}
          onLayoutChange={handleLayoutChange}
          isDraggable={isCustomizing}
          isResizable={isCustomizing}
          cols={12}
          rowHeight={80}
          containerPadding={[0, 0]}
          margin={[0, 0]}
          compactType={null}
          preventCollision={true}
        >
          {chartElements}
        </FixedGridLayout>
      </div>
    )
  },
  // Custom comparison function
  (prevProps, nextProps) => {
    // Only re-render if these specific things change
    return (
      prevProps.analysis === nextProps.analysis &&
      prevProps.data === nextProps.data &&
      prevProps.className === nextProps.className
    )
  }
)

DashboardLayoutOptimized.displayName = 'DashboardLayoutOptimized'