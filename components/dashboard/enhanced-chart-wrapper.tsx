'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import {
  Maximize2,
  Download,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit3,
  Settings,
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
import { Scorecard } from './scorecard'
import { DataRow, useDataStore, ChartTemplate } from '@/lib/store'
import { cn } from '@/lib/utils/cn'

const TableChartLazy = React.lazy(() => import('./charts/table-chart').then(m => ({ default: m.TableChart })))

interface EnhancedChartWrapperProps {
  id: string
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'scorecard' | 'table'
  title: string
  description: string
  data: DataRow[]
  dataKey: string[]
  isDragging?: boolean
  isSelected?: boolean
  onSelect?: (id: string) => void
  onEdit?: (id: string) => void
  className?: string
}

const COLORS = ['#2563eb', '#dc2626', '#ca8a04', '#16a34a', '#9333ea', '#c2410c']

export const EnhancedChartWrapper = React.memo<EnhancedChartWrapperProps>(function EnhancedChartWrapper({
  id,
  type,
  title,
  description,
  data,
  dataKey,
  isDragging = false,
  isSelected = false,
  onSelect,
  onEdit,
  className
}) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [showEditTitle, setShowEditTitle] = useState(false)
  const [editableTitle, setEditableTitle] = useState(title)
  const [editableDescription, setEditableDescription] = useState(description)

  const {
    setFullScreen,
    exportChart,
    getFilteredData,
    chartCustomizations,
    removeChart,
    duplicateChart,
    updateChartType,
    updateChartCustomization,
    chartTemplates,
    setContextMenu,
    contextMenuPosition,
    contextMenuChartId
  } = useDataStore()

  // Use filtered data
  const chartData = React.useMemo(() => {
    const filteredData = getFilteredData()
    if (!filteredData || !Array.isArray(filteredData) || filteredData.length === 0) {
      return []
    }
    return filteredData.slice(0, 1000) // Limit for performance
  }, [getFilteredData])

  // Get chart customization
  const customization = chartCustomizations[id]
  const isVisible = customization?.isVisible !== false

  // Calculate label rotation and margins based on data
  const labelInfo = React.useMemo(() => {
    if (!chartData.length || !safeDataKey.length) return { rotation: 0, margin: 40 }

    const sampleLabels = chartData.slice(0, Math.min(10, chartData.length))
      .map(row => String(row[safeDataKey[0]] || ''))
    const maxLabelLength = sampleLabels.reduce((max, label) => Math.max(max, label.length), 0)
    const avgLabelLength = sampleLabels.reduce((sum, label) => sum + label.length, 0) / sampleLabels.length

    let rotation = 0
    let bottomMargin = 40

    if (customization?.labelRotation === 'horizontal') {
      rotation = 0
      bottomMargin = Math.max(40, Math.ceil(avgLabelLength * 4))
    } else if (customization?.labelRotation === 'diagonal') {
      rotation = -45
      bottomMargin = Math.max(60, Math.ceil(maxLabelLength * 3))
    } else if (customization?.labelRotation === 'vertical') {
      rotation = -90
      bottomMargin = Math.max(80, maxLabelLength * 6)
    } else {
      // Auto mode
      if (maxLabelLength > 15 || sampleLabels.length > 8) {
        rotation = -45
        bottomMargin = Math.max(60, Math.ceil(maxLabelLength * 3))
      } else if (maxLabelLength > 8) {
        rotation = -30
        bottomMargin = Math.max(50, Math.ceil(maxLabelLength * 2.5))
      }
    }

    return {
      rotation,
      margin: bottomMargin,
      leftMargin: 60, // Extra space for y-axis label
      rightMargin: 20,
      topMargin: 20
    }
  }, [chartData, safeDataKey, customization?.labelRotation])

  // Generate default axis labels from data keys
  const defaultAxisLabels = React.useMemo(() => {
    if (!safeDataKey.length) return { x: '', y: '' }
    return {
      x: customization?.axisLabels?.x || safeDataKey[0] || '',
      y: customization?.axisLabels?.y || (safeDataKey[1] || 'Value')
    }
  }, [safeDataKey, customization?.axisLabels])

  // Safe dataKey handling
  const safeDataKey = React.useMemo(() => {
    if (!dataKey || !Array.isArray(dataKey) || dataKey.length === 0) {
      return ['index']
    }
    return dataKey
  }, [dataKey])

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
    removeChart(id)
    setContextMenu(null)
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

  // Handle click selection
  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(id)
    }
  }, [id, onSelect])

  // Pie chart data processing
  const pieData = React.useMemo(() => {
    if (type !== 'pie' || safeDataKey.length === 0 || chartData.length === 0) {
      return []
    }

    const categoryKey = safeDataKey[0]
    const valueKey = safeDataKey[1] || 'count'

    const counts: Record<string, number> = {}
    chartData.forEach(row => {
      if (!row || typeof row !== 'object') return

      const category = String(row[categoryKey] || 'Unknown')
      if (valueKey === 'count') {
        counts[category] = (counts[category] || 0) + 1
      } else {
        const value = Number(row[valueKey] || 0)
        if (!isNaN(value)) {
          counts[category] = (counts[category] || 0) + value
        }
      }
    })

    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [type, safeDataKey, chartData])

  // Render chart based on type
  const renderChart = () => {
    if (!chartData || chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          <div className="text-center">
            <div className="text-sm">No data available</div>
          </div>
        </div>
      )
    }

    const commonProps = {
      data: chartData,
      margin: {
        top: labelInfo.topMargin,
        right: labelInfo.rightMargin,
        left: labelInfo.leftMargin,
        bottom: labelInfo.margin
      }
    }

    const colors = customization?.colors || COLORS

    switch (type) {
      case 'scorecard':
        if (safeDataKey.length > 0 && chartData.length > 0) {
          const key = safeDataKey[0]
          const values = chartData.map(row => {
            const val = row[key]
            return typeof val === 'number' ? val : parseFloat(String(val)) || 0
          }).filter(v => !isNaN(v))

          const metricValue = values.length > 0
            ? customization?.aggregation === 'avg'
              ? values.reduce((a, b) => a + b, 0) / values.length
              : values.reduce((a, b) => a + b, 0)
            : 0

          return (
            <div className="h-full flex items-center justify-center">
              <Scorecard
                title={customization?.customTitle || title}
                value={metricValue}
                unit=""
                description={customization?.customDescription || description}
              />
            </div>
          )
        }
        return <div className="flex items-center justify-center h-64 text-gray-400">Invalid data</div>

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart {...commonProps}>
              {customization?.showGrid !== false && (
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              )}
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                angle={labelInfo.rotation}
                textAnchor={labelInfo.rotation < 0 ? 'end' : 'middle'}
                height={labelInfo.margin}
                interval={chartData.length > 20 ? 'preserveStartEnd' : 0}
                label={defaultAxisLabels.x ? {
                  value: defaultAxisLabels.x,
                  position: 'insideBottom',
                  offset: -10,
                  style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                } : undefined}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                width={labelInfo.leftMargin}
                label={defaultAxisLabels.y ? {
                  value: defaultAxisLabels.y,
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                } : undefined}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              {safeDataKey.slice(1).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 4 }}
                  animationDuration={customization?.animate !== false ? 1500 : 0}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart {...commonProps}>
              {customization?.showGrid !== false && (
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              )}
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                angle={labelInfo.rotation}
                textAnchor={labelInfo.rotation < 0 ? 'end' : 'middle'}
                height={labelInfo.margin}
                interval={chartData.length > 20 ? 'preserveStartEnd' : 0}
                label={defaultAxisLabels.x ? {
                  value: defaultAxisLabels.x,
                  position: 'insideBottom',
                  offset: -10,
                  style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                } : undefined}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                width={labelInfo.leftMargin}
                label={defaultAxisLabels.y ? {
                  value: defaultAxisLabels.y,
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                } : undefined}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              {safeDataKey.slice(1).map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[index % colors.length]}
                  radius={[2, 2, 0, 0]}
                  animationDuration={customization?.animate !== false ? 1500 : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={customization?.showLegend !== false ?
                  ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` : false}
                animationDuration={customization?.animate !== false ? 1500 : 0}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...commonProps}>
              {customization?.showGrid !== false && (
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              )}
              <XAxis
                dataKey={safeDataKey[0]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                angle={labelInfo.rotation}
                textAnchor={labelInfo.rotation < 0 ? 'end' : 'middle'}
                height={labelInfo.margin}
                interval={chartData.length > 20 ? 'preserveStartEnd' : 0}
                label={defaultAxisLabels.x ? {
                  value: defaultAxisLabels.x,
                  position: 'insideBottom',
                  offset: -10,
                  style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                } : undefined}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={{ stroke: '#e2e8f0' }}
                width={labelInfo.leftMargin}
                label={defaultAxisLabels.y ? {
                  value: defaultAxisLabels.y,
                  angle: -90,
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fontSize: '12px', fontWeight: '500', fill: '#374151' }
                } : undefined}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              {safeDataKey.slice(1).map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.3}
                  animationDuration={customization?.animate !== false ? 1500 : 0}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )

      case 'table':
        return (
          <React.Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="text-sm text-gray-400">Loading table...</div>
            </div>
          }>
            <TableChartLazy data={chartData} dataKey={safeDataKey} />
          </React.Suspense>
        )

      default:
        return <div className="flex items-center justify-center h-64 text-gray-400">Unsupported chart type</div>
    }
  }

  if (!isVisible) {
    return null
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={chartRef}
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
                    <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                      {customization?.customTitle || title}
                    </h3>
                    {(customization?.customDescription || description) && (
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        {customization?.customDescription || description}
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Controls - shown on hover or selection */}
              <div className={cn(
                "flex items-center space-x-1 transition-opacity duration-200",
                (isHovered || isSelected) ? "opacity-100" : "opacity-0"
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

                <DropdownMenu>
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
                        if (onEdit) onEdit(id)
                      }}
                      className="flex items-center space-x-2"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Customize</span>
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
            <div className="h-full w-full" style={{ minHeight: Math.max(280, labelInfo.margin + 200) }}>
              {renderChart()}
            </div>
          </div>

          {/* Selection indicator */}
          {isSelected && (
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-2 ring-blue-500 ring-opacity-50" />
          )}
        </div>
      </ContextMenuTrigger>

      {/* Context Menu */}
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
        {chartTemplates.map((template) => (
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
})