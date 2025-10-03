'use client'

import React, { useState, useEffect } from 'react'
import { Layout, Grid3x3, Settings, BarChart3 } from 'lucide-react'
import { Layout as GridLayout, Layouts } from 'react-grid-layout'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FixedGridLayout } from '@/components/ui/fixed-grid-layout'
import { MinimalChartWrapper } from './minimal-chart-wrapper'
import { useDataStore, DashboardLayout, AnalysisResult, DataRow } from '@/lib/store'
import { filterValidCharts } from '@/lib/utils/chart-validator'

interface DashboardLayoutComponentProps {
  analysis: AnalysisResult
  data: DataRow[]
  className?: string
}

export const DashboardLayoutComponent = React.memo<DashboardLayoutComponentProps>(function DashboardLayoutComponent({ 
  analysis, 
  data, 
  className 
}) {
  const {
    currentLayout,
    chartCustomizations,
    availableLayouts,
    isCustomizing,
    setIsCustomizing,
    setCurrentLayout,
    addCustomLayout,
    updateChartCustomization
  } = useDataStore()

  const [layout, setLayout] = useState<GridLayout[]>([])

  // Helper function to get the height of items in a row
  const getRowHeight = (layout: GridLayout[], y: number) => {
    const itemsInRow = layout.filter(item => item.y === y)
    if (itemsInRow.length === 0) return 5 // default height
    return Math.max(...itemsInRow.map(item => item.h))
  }

  // Generate fixed layout for 2-column grid
  useEffect(() => {
    const fixedLayout: GridLayout[] = []
    
    // Calculate layout positions
    let currentY = 0
    let currentRowWidth = 0
    let currentRowHeight = 0
    
    // Process all charts in their original order
    analysis.chartConfig.forEach((config, index) => {
      const chartId = config.id || `chart-${index}`
      const customization = chartCustomizations[chartId]
      const layoutPosition = currentLayout.chartPositions[chartId]
      // Use saved positions if they exist (from customization)
      const savedPosition = customization?.position || layoutPosition
      
      if (savedPosition && (savedPosition.x !== undefined && savedPosition.y !== undefined)) {
        fixedLayout.push({
          i: chartId,
          x: savedPosition.x,
          y: savedPosition.y,
          w: savedPosition.w,
          h: savedPosition.h,
          minW: config.type === 'scorecard' ? 2 : config.type === 'table' ? 8 : 4,
          minH: config.type === 'scorecard' ? 2 : config.type === 'table' ? 4 : 3,
          maxW: 12,
          maxH: 8
        })
      } else {
        // Determine default dimensions based on chart type
        let width, height, minWidth, minHeight
        
        switch (config.type) {
          case 'scorecard':
            width = 4  // 3 per row
            height = 3
            minWidth = 2
            minHeight = 2
            break
          case 'table':
            width = 12  // Full width
            height = 6  // Reasonable height for table
            minWidth = 8
            minHeight = 4
            break
          default:
            width = 6  // 2 per row
            height = 4
            minWidth = 4
            minHeight = 3
            break
        }
        
        // Check if this item fits in the current row
        if (currentRowWidth + width > 12) {
          // Move to next row
          currentY += currentRowHeight  // No extra spacing
          currentRowWidth = 0
          currentRowHeight = 0
        }
        
        fixedLayout.push({
          i: chartId,
          x: currentRowWidth,
          y: currentY,
          w: width,
          h: height,
          minW: minWidth,
          minH: minHeight,
          maxW: 12,
          maxH: 8
        })
        
        currentRowWidth += width
        currentRowHeight = Math.max(currentRowHeight, height)
        
        // If we've filled the row or it's a table (full width), move to next row
        if (currentRowWidth >= 12 || config.type === 'table') {
          currentY += currentRowHeight  // No extra spacing
          currentRowWidth = 0
          currentRowHeight = 0
        }
      }
    })
    
    setLayout(fixedLayout)
  }, [analysis.chartConfig, chartCustomizations, currentLayout, isCustomizing])

  // Filter out invalid charts before rendering
  const validCharts = React.useMemo(() => {
    console.log('🔍 [DASHBOARD_LAYOUT] Filtering charts:', {
      totalCharts: analysis.chartConfig?.length || 0,
      dataRows: data.length,
      chartTypes: analysis.chartConfig?.map(c => c.type).join(', ')
    })

    const filtered = filterValidCharts(analysis.chartConfig, data)

    console.log('🔍 [DASHBOARD_LAYOUT] Charts after filtering:', {
      validCharts: filtered.length,
      filteredOut: (analysis.chartConfig?.length || 0) - filtered.length
    })

    return filtered
  }, [analysis.chartConfig, data])
  
  // Update layout to only include valid charts
  React.useEffect(() => {
    setLayout(prevLayout => 
      prevLayout.filter(item => 
        validCharts.some(chart => 
          (chart.id || `chart-${analysis.chartConfig.indexOf(chart)}`) === item.i
        )
      )
    )
  }, [validCharts, analysis.chartConfig])
  
  // Convert valid chart configs to React elements for DraggableGrid
  const chartElements = validCharts.map((config, index) => {
    // Use the original index from analysis.chartConfig to maintain consistent IDs
    const originalIndex = analysis.chartConfig.indexOf(config)
    const chartId = config.id || `chart-${originalIndex}`
    
    return (
      <div key={chartId} className="h-full">
        <MinimalChartWrapper
          id={chartId}
          type={config.type}
          title={config.title}
          description={config.description}
          data={data}
          dataKey={config.dataKey}
          dataMapping={config.dataMapping}
        />
      </div>
    )
  })

  const handleLayoutChange = React.useCallback((newLayout: GridLayout[]) => {
    // Update chart positions in the store
    newLayout.forEach(item => {
      updateChartCustomization(item.i, {
        position: { x: item.x, y: item.y, w: item.w, h: item.h }
      })
    })
    
    // Update layout state
    setLayout(newLayout)
  }, [updateChartCustomization])

  const createCompactLayout = () => {
    const compactLayout: DashboardLayout = {
      id: `layout-${Date.now()}`,
      name: 'Compact Layout',
      isDefault: false,
      grid: {
        cols: 12,
        rows: 8,
        gap: 16
      },
      chartPositions: analysis.chartConfig.reduce((acc, config, index) => {
        const chartId = config.id || `chart-${index}`
        
        // In compact layout, make everything smaller and fit more per row
        let w, h
        switch (config.type) {
          case 'scorecard':
            w = 3  // 4 per row in compact mode
            h = 2
            break
          case 'table':
            w = 6  // 2 per row in compact mode
            h = 6  // Smaller height
            break
          default:
            w = 4  // 3 per row in compact mode
            h = 4
            break
        }
        
        // Simple grid placement
        let x = 0
        let y = 0
        let currentIndex = 0
        
        // Calculate position based on previous items
        for (let i = 0; i < index; i++) {
          const prevConfig = analysis.chartConfig[i]
          let prevW
          switch (prevConfig.type) {
            case 'scorecard':
              prevW = 3
              break
            case 'table':
              prevW = 6
              break
            default:
              prevW = 4
              break
          }
          
          x += prevW
          if (x + w > 12) {
            x = 0
            y += 4  // Standard row height in compact mode
          }
        }
        
        acc[chartId] = { x, y, w, h }
        return acc
      }, {} as Record<string, { x: number; y: number; w: number; h: number }>)
    }
    
    addCustomLayout(compactLayout)
  }

  const createWideLayout = () => {
    const wideLayout: DashboardLayout = {
      id: `layout-${Date.now()}`,
      name: 'Wide Layout',
      isDefault: false,
      grid: {
        cols: 12,
        rows: 10,
        gap: 24
      },
      chartPositions: analysis.chartConfig.reduce((acc, config, index) => {
        const chartId = config.id || `chart-${index}`
        acc[chartId] = {
          x: 0,
          y: index * 5,
          w: 12,
          h: 4
        }
        return acc
      }, {} as Record<string, { x: number; y: number; w: number; h: number }>)
    }
    
    addCustomLayout(wideLayout)
  }

  // Clean Apple-style layout with generous whitespace
  return (
    <div className={cn('space-y-12', className)}>
      {validCharts.length === 0 ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 mx-auto bg-gray-100 rounded-3xl flex items-center justify-center">
              <BarChart3 className="w-10 h-10 text-gray-400" />
            </div>
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">No visualizations available</h3>
              <p className="text-gray-500 mt-3 text-base leading-relaxed">
                The data doesn't support meaningful chart creation. Try uploading a different dataset.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {validCharts.map((config, index) => {
            const originalIndex = analysis.chartConfig.indexOf(config)
            const chartId = config.id || `chart-${originalIndex}`

            return (
              <div key={chartId}>
                <MinimalChartWrapper
                  id={chartId}
                  type={config.type}
                  title={config.title}
                  description={config.description}
                  data={data}
                  dataKey={config.dataKey}
                  dataMapping={config.dataMapping}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})