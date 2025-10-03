'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface LegendItem {
  value: string
  type?: string
  id?: string
  color?: string
}

interface CollapsibleLegendProps {
  payload?: LegendItem[]
  maxVisibleItems?: number
  wrapperStyle?: React.CSSProperties
  iconType?: 'line' | 'square' | 'circle' | ((value: any) => React.ReactElement)
  iconSize?: number
  formatter?: (value: any, entry?: any, index?: number) => any
  layout?: 'horizontal' | 'vertical'
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
}

/**
 * CollapsibleLegend - A custom legend component for Recharts that handles many items gracefully
 *
 * Features:
 * - Shows first N items by default (configurable via maxVisibleItems)
 * - Provides a "Show more" / "Show less" button for remaining items
 * - Maintains consistent styling with Recharts default legend
 * - Supports all standard Recharts legend props (formatter, iconType, etc.)
 * - Responsive and accessible
 */
export const CollapsibleLegend: React.FC<CollapsibleLegendProps> = ({
  payload = [],
  maxVisibleItems = 5,
  wrapperStyle = {},
  iconType = 'square',
  iconSize = 14,
  formatter,
  layout = 'horizontal',
  align = 'center',
  verticalAlign = 'bottom'
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // If there are fewer items than maxVisibleItems, show all
  const showExpandButton = payload.length > maxVisibleItems
  const visibleItems = isExpanded ? payload : payload.slice(0, maxVisibleItems)
  const hiddenCount = payload.length - maxVisibleItems

  // Render icon based on iconType
  const renderIcon = (item: LegendItem, index: number) => {
    const color = item.color || '#8884d8'

    // If iconType is a function, use it
    if (typeof iconType === 'function') {
      return iconType(item.value)
    }

    // Default icon rendering
    switch (iconType) {
      case 'line':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 14 14" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
            <line x1="0" y1="7" x2="14" y2="7" stroke={color} strokeWidth="2" />
          </svg>
        )
      case 'circle':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 14 14" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
            <circle cx="7" cy="7" r="6" fill={color} />
          </svg>
        )
      case 'square':
      default:
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 14 14" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }}>
            <rect x="0" y="0" width="14" height="14" fill={color} />
          </svg>
        )
    }
  }

  // Calculate alignment styles
  const alignmentStyles: React.CSSProperties = {}
  if (align === 'center') {
    alignmentStyles.justifyContent = 'center'
  } else if (align === 'right') {
    alignmentStyles.justifyContent = 'flex-end'
  } else {
    alignmentStyles.justifyContent = 'flex-start'
  }

  // Vertical alignment
  if (verticalAlign === 'top') {
    alignmentStyles.alignItems = 'flex-start'
  } else if (verticalAlign === 'middle') {
    alignmentStyles.alignItems = 'center'
  } else {
    alignmentStyles.alignItems = 'flex-end'
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: layout === 'vertical' ? 'column' : 'row',
    flexWrap: layout === 'horizontal' ? 'wrap' : 'nowrap',
    gap: layout === 'vertical' ? '6px' : '12px',
    ...alignmentStyles,
    ...wrapperStyle
  }

  return (
    <div style={containerStyle}>
      {/* Legend Items */}
      <div style={{
        display: 'flex',
        flexDirection: layout === 'vertical' ? 'column' : 'row',
        flexWrap: layout === 'horizontal' ? 'wrap' : 'nowrap',
        gap: layout === 'vertical' ? '6px' : '12px',
        ...alignmentStyles
      }}>
        {visibleItems.map((item, index) => {
          const displayValue = formatter ? formatter(item.value, item, index) : item.value

          return (
            <div
              key={`legend-item-${index}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: 'inherit',
                color: '#374151',
                cursor: 'default'
              }}
            >
              {renderIcon(item, index)}
              <span style={{ lineHeight: '1' }}>{displayValue}</span>
            </div>
          )
        })}
      </div>

      {/* Expand/Collapse Button */}
      {showExpandButton && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded",
            "text-xs font-medium text-blue-600 hover:text-blue-700",
            "hover:bg-blue-50 transition-colors",
            "border border-blue-200 hover:border-blue-300"
          )}
          style={{
            fontSize: 'inherit',
            alignSelf: layout === 'vertical' ? 'flex-start' : 'center'
          }}
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Show less legend items' : `Show ${hiddenCount} more legend items`}
        >
          {isExpanded ? (
            <>
              <span>Show less</span>
              <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>+{hiddenCount} more</span>
              <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </div>
  )
}

/**
 * Helper function to use CollapsibleLegend with Recharts
 *
 * Usage in Recharts:
 * <Legend content={renderCollapsibleLegend({ maxVisibleItems: 5 })} />
 */
export function renderCollapsibleLegend(props?: Partial<CollapsibleLegendProps>) {
  return function LegendContent(legendProps: any) {
    return <CollapsibleLegend {...legendProps} {...props} />
  }
}
