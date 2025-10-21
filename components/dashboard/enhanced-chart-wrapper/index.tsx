'use client'

import React, { useState, useCallback, useRef, useMemo } from 'react'
import {
  Maximize2,
  Download,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit3,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator
} from '@/components/ui/context-menu'
import { ChartCustomizationPanel } from '../chart-customization-panel'
import { useDataStore, type DataRow } from '@/lib/stores/data-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useChartStore, type ChartTemplate, type ChartType } from '@/lib/stores/chart-store'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils/cn'
import { QualityBadge } from '../quality-indicator'

// Import types
import type { EnhancedChartWrapperProps, ScatterData } from './types'

// Import constants
import { COLORS } from './constants'

// Import hooks
import { useChartData } from './hooks/useChartData'
import { useResponsiveDesign } from './hooks/useResponsiveDesign'
import { useDualAxis } from './hooks/useDualAxis'
import { useChartValidation } from './hooks/useChartValidation'

// Import utility components
import { UnconfiguredPlaceholder } from './components/UnconfiguredPlaceholder'
import { ChartFallback, ChartTooSmallFallback } from './components/ChartFallback'

// Import chart renderers
import { ScorecardRenderer } from './renderers/ScorecardRenderer'
import { LineRenderer } from './renderers/LineRenderer'
import { BarRenderer } from './renderers/BarRenderer'
import { PieRenderer } from './renderers/PieRenderer'
import { AreaRenderer } from './renderers/AreaRenderer'
import { ScatterRenderer } from './renderers/ScatterRenderer'
import { TableRenderer } from './renderers/TableRenderer'
import { ComboRenderer } from './renderers/ComboRenderer'
import { FunnelRenderer } from './renderers/FunnelRenderer'
import { HeatmapRenderer } from './renderers/HeatmapRenderer'
import { GaugeRenderer } from './renderers/GaugeRenderer'
import { CohortRenderer } from './renderers/CohortRenderer'
import { BulletRenderer } from './renderers/BulletRenderer'
import { TreemapRenderer } from './renderers/TreemapRenderer'
import { SparklineRenderer } from './renderers/SparklineRenderer'
import { WaterfallRenderer } from './renderers/WaterfallRenderer'

export const EnhancedChartWrapper = React.memo<EnhancedChartWrapperProps>(function EnhancedChartWrapper({
  id,
  type,
  title,
  description,
  data,
  dataKey,
  configDataMapping,
  isDragging = false,
  isSelected = false,
  onSelect,
  onEdit,
  className,
  qualityScore,
  initialTab,
  onDataPointClick
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [showEditTitle, setShowEditTitle] = useState(false)
  const [editableTitle, setEditableTitle] = useState(title)
  const [editableDescription, setEditableDescription] = useState(description)

  // UI Store selectors
  const setFullScreen = useUIStore(state => state.setFullScreen)
  const setContextMenu = useUIStore(state => state.setContextMenu)
  const contextMenuPosition = useUIStore(state => state.contextMenuPosition)
  const contextMenuChartId = useUIStore(state => state.contextMenuChartId)

  // Chart Store selectors
  const exportChart = useChartStore(state => state.exportChart)
  const chartCustomizations = useChartStore(state => state.chartCustomizations)
  const removeChart = useChartStore(state => state.removeChart)
  const duplicateChart = useChartStore(state => state.duplicateChart)
  const updateChartType = useChartStore(state => state.updateChartType)
  const updateChartCustomization = useChartStore(state => state.updateChartCustomization)
  const chartTemplates = useChartStore(state => state.chartTemplates)
  const draftChart = useChartStore(state => state.draftChart)

  // Get chart customization
  const customization = chartCustomizations[id]
  const isVisible = customization?.isVisible !== false

  // CRITICAL FIX: Use customized chart type if available
  const effectiveChartType = (customization?.chartType || type) as ChartType

  // Check if this is a draft chart (newly added, not yet configured)
  const isDraftChart = React.useMemo(() => {
    return draftChart?.id === id
  }, [draftChart, id])

  // Use validation hook to check if chart is configured
  const isChartConfigured = useChartValidation({
    effectiveChartType,
    customization,
    configDataMapping
  })

  // Process chart data using hook
  const chartData = useChartData({
    data,
    type,
    title,
    customization,
    configDataMapping
  })

  // Safe dataKey handling
  const safeDataKey = React.useMemo(() => {
    const effectiveMapping = {
      ...configDataMapping,
      ...customization?.dataMapping
    }

    if (effectiveMapping && Object.keys(effectiveMapping).length > 0) {
      const mapping = effectiveMapping

      switch (effectiveChartType) {
        case 'line':
        case 'bar':
          if (mapping.category && mapping.values) {
            const values = Array.isArray(mapping.values) ? mapping.values : [mapping.values]
            return [mapping.category, ...values]
          }
          if (mapping.xAxis && (mapping.yAxis1 || mapping.yAxis2)) {
            const allYAxes = []
            if (mapping.yAxis1) {
              const yAxis1Values = Array.isArray(mapping.yAxis1) ? mapping.yAxis1 : [mapping.yAxis1]
              allYAxes.push(...yAxis1Values)
            }
            if (mapping.yAxis2) {
              const yAxis2Values = Array.isArray(mapping.yAxis2) ? mapping.yAxis2 : [mapping.yAxis2]
              allYAxes.push(...yAxis2Values)
            }
            return [mapping.xAxis, ...allYAxes]
          }
          if (mapping.xAxis && mapping.yAxis) {
            if (Array.isArray(mapping.yAxis)) {
              return [mapping.xAxis, ...mapping.yAxis]
            } else {
              return [mapping.xAxis, mapping.yAxis]
            }
          }
          break

        case 'area':
        case 'scatter':
          if (mapping.xAxis && (mapping.yAxis1 || mapping.yAxis2)) {
            const allYAxes = []
            if (mapping.yAxis1) {
              const yAxis1Values = Array.isArray(mapping.yAxis1) ? mapping.yAxis1 : [mapping.yAxis1]
              allYAxes.push(...yAxis1Values)
            }
            if (mapping.yAxis2) {
              const yAxis2Values = Array.isArray(mapping.yAxis2) ? mapping.yAxis2 : [mapping.yAxis2]
              allYAxes.push(...yAxis2Values)
            }
            return [mapping.xAxis, ...allYAxes]
          }
          if (mapping.xAxis && mapping.yAxis) {
            if (Array.isArray(mapping.yAxis)) {
              return [mapping.xAxis, ...mapping.yAxis]
            } else {
              return [mapping.xAxis, mapping.yAxis]
            }
          }
          break

        case 'pie':
          if (mapping.category) {
            return mapping.value ? [mapping.category, mapping.value] : [mapping.category]
          }
          break

        case 'scorecard':
          if (mapping.formula && mapping.formulaAlias) {
            return [mapping.formulaAlias]
          } else if (mapping.metric) {
            return [mapping.metric]
          }
          break

        case 'table':
          if (mapping.yAxis) {
            return Array.isArray(mapping.yAxis) ? mapping.yAxis : [mapping.yAxis]
          }
          break
      }
    }

    if (!dataKey || !Array.isArray(dataKey) || dataKey.length === 0) {
      return ['index']
    }
    return dataKey
  }, [dataKey, configDataMapping, customization?.dataMapping, effectiveChartType])

  // Detect dual axis configuration
  const dualAxisConfig = useDualAxis({
    type,
    safeDataKey,
    chartData,
    customization,
    configDataMapping
  })

  // Use responsive design hook
  const {
    chartContainerRef,
    containerSizing,
    responsiveFeatures,
    smartAxisScaling,
    enhancedAxisLabels,
    truncateLabel,
    measureText
  } = useResponsiveDesign({
    type,
    chartData,
    safeDataKey,
    customization,
    dualAxisConfig
  })

  // Pie chart data processing
  const colors = customization?.colors || COLORS

  // Scatter chart data processing - MUST be at component level to comply with React hooks rules
  const scatterData = React.useMemo<ScatterData>(() => {
    if (type !== 'scatter' || safeDataKey.length < 2 || chartData.length === 0) {
      return { numericData: [], groups: [] }
    }

    const effectiveDataMapping = customization?.dataMapping || configDataMapping
    const sizeKey = effectiveDataMapping?.size
    const colorKey = effectiveDataMapping?.color

    const parseNumericValue = (val: any): number => {
      if (typeof val === 'number') return val
      if (typeof val !== 'string') return 0
      const cleaned = val.replace(/[€$£¥,\s%]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }

    const numericData = chartData.map(row => ({
      ...row,
      [safeDataKey[0]]: parseNumericValue(row[safeDataKey[0]]),
      [safeDataKey[1]]: parseNumericValue(row[safeDataKey[1]]),
      ...(sizeKey ? { [sizeKey]: parseNumericValue(row[sizeKey]) } : {})
    }))

    const groups = (() => {
      if (!colorKey) {
        return [{
          name: 'Data',
          color: colors[0],
          data: numericData
        }]
      }

      const groupMap: Record<string, DataRow[]> = {}
      numericData.forEach(row => {
        const colorValue = String((row as any)[colorKey as string] || 'Unknown')
        if (!groupMap[colorValue]) {
          groupMap[colorValue] = []
        }
        groupMap[colorValue].push(row)
      })

      return Object.entries(groupMap).map(([name, data], index) => ({
        name,
        color: colors[index % colors.length],
        data
      }))
    })()

    return { numericData, groups }
  }, [type, safeDataKey, chartData, customization?.dataMapping, configDataMapping, colors])

  // Combo chart data processing - MUST be at component level
  const comboData = React.useMemo(() => {
    if (type !== 'combo' || chartData.length === 0) {
      return []
    }

    const effectiveDataMapping = customization?.dataMapping || configDataMapping

    const yAxis1Metrics = effectiveDataMapping?.yAxis1
      ? (Array.isArray(effectiveDataMapping.yAxis1) ? effectiveDataMapping.yAxis1 : [effectiveDataMapping.yAxis1])
      : []
    const yAxis2Metrics = effectiveDataMapping?.yAxis2
      ? (Array.isArray(effectiveDataMapping.yAxis2) ? effectiveDataMapping.yAxis2 : [effectiveDataMapping.yAxis2])
      : []

    const parseNumericValue = (val: any): number => {
      if (typeof val === 'number') return val
      if (typeof val !== 'string') return 0
      const cleaned = val.replace(/[€$£¥,\s%]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }

    return chartData.map(row => {
      const transformed = { ...row }
      ;[...yAxis1Metrics, ...yAxis2Metrics].forEach(key => {
        if (row[key] !== undefined) {
          transformed[key] = parseNumericValue(row[key])
        }
      })
      return transformed
    })
  }, [type, chartData, customization?.dataMapping, configDataMapping])

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY }, id)
  }, [id, setContextMenu])

  // Handle chart actions
  const handleDuplicate = useCallback(() => {
    duplicateChart(id)
    setContextMenu(null)
  }, [id, duplicateChart, setContextMenu])

  const handleDelete = useCallback(() => {
    setIsDropdownOpen(false)
    setIsHovered(false)
    setContextMenu(null)
    removeChart(id)
  }, [id, removeChart, setContextMenu])

  const handleChangeType = useCallback((newType: ChartTemplate['type']) => {
    updateChartType(id, newType)
    setContextMenu(null)
  }, [id, updateChartType, setContextMenu])

  const handleToggleVisibility = useCallback(() => {
    updateChartCustomization(id, { isVisible: !isVisible })
  }, [id, updateChartCustomization, isVisible])

  const handleTitleEdit = useCallback(() => {
    updateChartCustomization(id, {
      customTitle: editableTitle,
      customDescription: editableDescription
    })
    setShowEditTitle(false)
  }, [id, editableTitle, editableDescription, updateChartCustomization])

  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(id)
    }
  }, [id, onSelect])

  // Render chart based on type
  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return <ChartFallback />
    }

    // Fallback view for very small containers (EXCEPT scorecards which are designed to be small)
    if (responsiveFeatures.useFallbackView && type !== 'scorecard') {
      return <ChartTooSmallFallback />
    }

    // If not configured, show placeholder instead of chart
    if (!isChartConfigured) {
      return (
        <UnconfiguredPlaceholder
          id={id}
          title={title}
          isSelected={isSelected}
          className={className}
          onSelect={onSelect}
          onEdit={onEdit}
        />
      )
    }

    // Render appropriate chart based on type
    switch (effectiveChartType) {
      case 'scorecard':
        return (
          <ScorecardRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
            title={title}
          />
        )

      case 'line':
        return (
          <LineRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            responsiveFeatures={responsiveFeatures}
            smartAxisScaling={smartAxisScaling}
            enhancedAxisLabels={enhancedAxisLabels}
            dualAxisConfig={dualAxisConfig}
            colors={colors}
            truncateLabel={truncateLabel}
            onDataPointClick={onDataPointClick}
          />
        )

      case 'bar':
        return (
          <BarRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            responsiveFeatures={responsiveFeatures}
            smartAxisScaling={smartAxisScaling}
            enhancedAxisLabels={enhancedAxisLabels}
            dualAxisConfig={dualAxisConfig}
            colors={colors}
            truncateLabel={truncateLabel}
            onDataPointClick={onDataPointClick}
          />
        )

      case 'pie':
        return (
          <PieRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            responsiveFeatures={responsiveFeatures}
            truncateLabel={truncateLabel}
            colors={colors}
            onDataPointClick={onDataPointClick}
          />
        )

      case 'area':
        return (
          <AreaRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            responsiveFeatures={responsiveFeatures}
            smartAxisScaling={smartAxisScaling}
            enhancedAxisLabels={enhancedAxisLabels}
            dualAxisConfig={dualAxisConfig}
            colors={colors}
            truncateLabel={truncateLabel}
            onDataPointClick={onDataPointClick}
          />
        )

      case 'scatter':
        return (
          <ScatterRenderer
            scatterData={scatterData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
            responsiveFeatures={responsiveFeatures}
            smartAxisScaling={smartAxisScaling}
            enhancedAxisLabels={enhancedAxisLabels}
            truncateLabel={truncateLabel}
            colors={colors}
            onDataPointClick={onDataPointClick}
          />
        )

      case 'table':
        return <TableRenderer chartData={chartData} safeDataKey={safeDataKey} />

      case 'combo':
        return (
          <ComboRenderer
            comboData={comboData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
            responsiveFeatures={responsiveFeatures}
            smartAxisScaling={smartAxisScaling}
            enhancedAxisLabels={enhancedAxisLabels}
            truncateLabel={truncateLabel}
            onDataPointClick={onDataPointClick}
          />
        )

      case 'funnel':
        return (
          <FunnelRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
            colors={colors}
          />
        )

      case 'heatmap':
        return (
          <HeatmapRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
          />
        )

      case 'gauge':
        return (
          <GaugeRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
          />
        )

      case 'cohort':
        return (
          <CohortRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
          />
        )

      case 'bullet':
        return (
          <BulletRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
          />
        )

      case 'treemap':
        return (
          <TreemapRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
            colors={colors}
          />
        )

      case 'sparkline':
        return (
          <SparklineRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
            colors={colors}
          />
        )

      case 'waterfall':
        return (
          <WaterfallRenderer
            chartData={chartData}
            safeDataKey={safeDataKey}
            customization={customization}
            configDataMapping={configDataMapping}
          />
        )

      default:
        return <ChartFallback message="Unsupported chart type" />
    }
  }

  // CRITICAL FIX: If chart has no customization AND no data, return null
  if (!customization && (!chartData || chartData.length === 0)) {
    return null
  }

  // For scorecards, render with minimal wrapper
  if (type === 'scorecard') {
    if (!isVisible) {
      return null
    }
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={(node) => {
              chartRef.current = node
              chartContainerRef.current = node
            }}
            data-chart-id={id}
            data-chart-type={type}
            className={cn(
              "group relative h-full w-full transition-all duration-200 cursor-pointer select-none",
              isSelected && "ring-2 ring-blue-500 ring-opacity-50 rounded-lg",
              isDragging && "opacity-50 rotate-2 scale-105",
              className
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
          >
            {(isHovered || isSelected || isDropdownOpen) && (
              <div className="absolute top-2 right-2 z-10 flex items-center space-x-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFullScreen(id)
                  }}
                  className="h-7 w-7 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="View fullscreen"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                <ChartCustomizationPanel
                  chartId={id}
                  title={title}
                  description={description}
                  chartType={type}
                  customization={customization as any}
                  onCustomizationChange={updateChartCustomization}
                  initialTab={initialTab}
                  configDataMapping={configDataMapping}
                  autoOpen={(isSelected && initialTab === 'data') || isDraftChart}
                />
                <DropdownMenu onOpenChange={setIsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="More options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicate()
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Duplicate</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        exportChart(id, 'png')
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export as PNG</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete()
                      }}
                      className="flex items-center space-x-2 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            {renderChart()}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={handleDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowEditTitle(true)}>
            <Edit3 className="h-4 w-4 mr-2" />
            Edit Title
          </ContextMenuItem>
          <ContextMenuItem onClick={() => exportChart(id, 'png')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </ContextMenuItem>
          <ContextMenuSeparator />
          {chartTemplates.map((template: any) => (
            <ContextMenuItem
              key={template.id}
              onClick={() => handleChangeType(template.type)}
              disabled={template.type === type}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Change to {template.name}
            </ContextMenuItem>
          ))}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleToggleVisibility}>
            {isVisible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {isVisible ? 'Hide' : 'Show'}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDelete} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  // For all other chart types, render with full header/chrome
  if (!isVisible) {
    return null
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={(node) => {
            chartRef.current = node
            chartContainerRef.current = node
          }}
          data-chart-id={id}
          data-chart-type={type}
          className={cn(
            "group relative bg-white rounded-xl border-2 transition-all duration-200 cursor-pointer select-none h-full flex flex-col",
            isSelected
              ? "border-blue-500 shadow-lg ring-2 ring-blue-500 ring-opacity-20"
              : "border-gray-200/60 hover:border-gray-300/80 hover:shadow-sm",
            isDragging && "opacity-50 rotate-2 scale-105",
            className
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200/60">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {showEditTitle ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editableTitle}
                      onChange={(e) => setEditableTitle(e.target.value)}
                      className="text-lg font-semibold text-gray-900 leading-tight bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500"
                      onBlur={handleTitleEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTitleEdit()
                        if (e.key === 'Escape') {
                          setEditableTitle(title)
                          setShowEditTitle(false)
                        }
                      }}
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editableDescription}
                      onChange={(e) => setEditableDescription(e.target.value)}
                      className="text-sm text-gray-600 leading-relaxed bg-transparent border-b border-gray-300 focus:outline-none focus:border-blue-500"
                      placeholder="Description"
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                        {customization?.customTitle || title}
                        {type === 'bar' && customization?.dataMapping?.sortBy && customization?.dataMapping?.limit && (
                          <span className="ml-2 text-sm font-normal text-blue-600">
                            ({customization.dataMapping.sortOrder === 'desc' ? 'Top' : 'Bottom'} {customization.dataMapping.limit})
                          </span>
                        )}
                      </h3>
                      {qualityScore !== undefined && qualityScore > 0 && (
                        <QualityBadge score={qualityScore} />
                      )}
                    </div>
                    {(type as any) !== 'scorecard' && (customization?.customDescription || description) && (
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        {customization?.customDescription || description}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className={cn(
                "flex items-center space-x-1 transition-opacity duration-200",
                (isHovered || isSelected || isDropdownOpen) ? "opacity-100" : "opacity-0"
              )}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowEditTitle(true)
                  }}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="Edit title"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleVisibility()
                  }}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title={isVisible ? "Hide chart" : "Show chart"}
                >
                  {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>

                <ChartCustomizationPanel
                  chartId={id}
                  title={title}
                  description={description}
                  chartType={type}
                  customization={customization as any}
                  onCustomizationChange={updateChartCustomization}
                  initialTab={initialTab}
                  configDataMapping={configDataMapping}
                  autoOpen={(isSelected && initialTab === 'data') || isDraftChart}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFullScreen(id)
                  }}
                  className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  title="View fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>

                <DropdownMenu onOpenChange={setIsDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      title="More options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicate()
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Duplicate</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        exportChart(id, 'png')
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Export as PNG</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete()
                      }}
                      className="flex items-center space-x-2 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Chart Content */}
          <div className="px-6 py-6 flex-1 min-h-0">
            <div className="h-full w-full" style={{ minHeight: 360 }}>
              {renderChart()}
            </div>
          </div>

          {isSelected && (
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-2 ring-blue-500 ring-opacity-50" />
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleDuplicate}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setShowEditTitle(true)}>
          <Edit3 className="h-4 w-4 mr-2" />
          Edit Title
        </ContextMenuItem>
        <ContextMenuItem onClick={() => exportChart(id, 'png')}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </ContextMenuItem>
        <ContextMenuSeparator />
        {chartTemplates.map((template: any) => (
          <ContextMenuItem
            key={template.id}
            onClick={() => handleChangeType(template.type)}
            disabled={template.type === type}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Change to {template.name}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleToggleVisibility}>
          {isVisible ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
          {isVisible ? 'Hide' : 'Show'}
        </ContextMenuItem>
        <ContextMenuItem onClick={handleDelete} className="text-red-600">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}, (prevProps, nextProps) => {
  const shallowEqualArray = (a: any[], b: any[]): boolean => {
    if (a === b) return true
    if (a.length !== b.length) return false
    return a === b
  }

  const shallowEqualObject = (a: any, b: any): boolean => {
    if (a === b) return true
    if (!a || !b) return false
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    return keysA.every(key => a[key] === b[key])
  }

  const dataUnchanged = (
    prevProps.data === nextProps.data ||
    prevProps.data.length === nextProps.data.length
  )

  const isEqual = (
    prevProps.id === nextProps.id &&
    prevProps.type === nextProps.type &&
    prevProps.title === nextProps.title &&
    prevProps.description === nextProps.description &&
    dataUnchanged &&
    shallowEqualArray(prevProps.dataKey, nextProps.dataKey) &&
    shallowEqualObject(prevProps.configDataMapping, nextProps.configDataMapping) &&
    prevProps.qualityScore === nextProps.qualityScore &&
    prevProps.className === nextProps.className
  )

  return isEqual
})
