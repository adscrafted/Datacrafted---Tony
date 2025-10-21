/**
 * Style Tab Component
 * Handles theme, colors, legend, and grid customization
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'
import { ColorPicker } from '@/components/ui/color-picker'
import type { ChartCustomization } from '@/lib/store'
import { THEME_OPTIONS, DEFAULT_CHART_COLORS } from '../constants'

interface StyleTabProps {
  customization?: ChartCustomization
  onUpdate: (updates: Partial<ChartCustomization>) => void
}

export function StyleTab({ customization, onUpdate }: StyleTabProps) {
  return (
    <div className="space-y-4">
      {/* Theme */}
      <div>
        <label className="text-sm font-medium mb-2 block">Theme</label>
        <div className="grid grid-cols-2 gap-2">
          {THEME_OPTIONS.map(theme => (
            <button
              key={theme}
              onClick={() => onUpdate({ theme })}
              className={cn(
                'px-3 py-2 rounded border text-sm capitalize transition-colors',
                (customization?.theme || 'default') === theme
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div>
        <label className="text-sm font-medium mb-2 block">Chart Colors</label>
        <div className="grid grid-cols-3 gap-2">
          {(customization?.colors || DEFAULT_CHART_COLORS).map((color, index) => (
            <div key={index} className="flex items-center space-x-2">
              <span className="text-xs w-6">{index + 1}:</span>
              <ColorPicker
                value={color}
                onChange={(newColor) => {
                  const newColors = [...(customization?.colors || DEFAULT_CHART_COLORS)]
                  newColors[index] = newColor
                  onUpdate({ colors: newColors })
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Show Legend</span>
        <button
          onClick={() => onUpdate({ showLegend: !(customization?.showLegend ?? true) })}
          className={cn(
            'w-10 h-5 rounded-full transition-colors relative',
            (customization?.showLegend ?? true) ? 'bg-primary' : 'bg-gray-300'
          )}
        >
          <div
            className={cn(
              'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
              (customization?.showLegend ?? true) ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {/* Grid */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Show Grid</span>
        <button
          onClick={() => onUpdate({ showGrid: !(customization?.showGrid ?? true) })}
          className={cn(
            'w-10 h-5 rounded-full transition-colors relative',
            (customization?.showGrid ?? true) ? 'bg-primary' : 'bg-gray-300'
          )}
        >
          <div
            className={cn(
              'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
              (customization?.showGrid ?? true) ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  )
}
