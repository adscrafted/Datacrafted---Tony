/**
 * Axes Tab Component
 * Handles axis labels, rotation, and sizing configuration
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils/cn'
import type { ChartCustomization } from '@/lib/store'
import { LABEL_ROTATION_OPTIONS } from '../constants'

interface AxesTabProps {
  customization?: ChartCustomization
  onUpdate: (updates: Partial<ChartCustomization>) => void
}

export function AxesTab({ customization, onUpdate }: AxesTabProps) {
  return (
    <div className="space-y-4">
      {/* X-Axis Label */}
      <div>
        <label className="text-sm font-medium mb-1 block">X-Axis Label</label>
        <input
          type="text"
          value={customization?.axisLabels?.x || ''}
          onChange={(e) => onUpdate({
            axisLabels: {
              ...customization?.axisLabels,
              x: e.target.value
            }
          })}
          placeholder="X-axis label"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>

      {/* Y-Axis Label */}
      <div>
        <label className="text-sm font-medium mb-1 block">Y-Axis Label</label>
        <input
          type="text"
          value={customization?.axisLabels?.y || ''}
          onChange={(e) => onUpdate({
            axisLabels: {
              ...customization?.axisLabels,
              y: e.target.value
            }
          })}
          placeholder="Y-axis label"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
      </div>

      {/* Label Rotation */}
      <div>
        <label className="text-sm font-medium mb-2 block">X-Axis Label Rotation</label>
        <div className="grid grid-cols-2 gap-2">
          {LABEL_ROTATION_OPTIONS.map(rotation => (
            <button
              key={rotation}
              onClick={() => onUpdate({ labelRotation: rotation })}
              className={cn(
                'px-3 py-2 rounded border text-sm capitalize transition-colors',
                (customization?.labelRotation || 'auto') === rotation
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              {rotation}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Auto rotation adjusts based on label length automatically
        </p>
      </div>

      {/* Auto Sizing */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Auto Sizing</span>
          <p className="text-xs text-gray-500">Automatically adjust chart size based on data</p>
        </div>
        <button
          onClick={() => onUpdate({ autoSize: !(customization?.autoSize ?? true) })}
          className={cn(
            'w-10 h-5 rounded-full transition-colors relative',
            (customization?.autoSize ?? true) ? 'bg-primary' : 'bg-gray-300'
          )}
        >
          <div
            className={cn(
              'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-transform',
              (customization?.autoSize ?? true) ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  )
}
