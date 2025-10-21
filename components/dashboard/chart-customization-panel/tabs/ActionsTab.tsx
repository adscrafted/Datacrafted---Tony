/**
 * Actions Tab Component
 * Handles export, duplicate, and advanced chart options
 */

'use client'

import React from 'react'
import { Download, Copy } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import type { ChartCustomization } from '@/lib/store'
import { EXPORT_FORMATS } from '../constants'

interface ActionsTabProps {
  chartId: string
  customization?: ChartCustomization
  onUpdate: (updates: Partial<ChartCustomization>) => void
  onExport: (format: 'png' | 'pdf' | 'svg') => void
  onDuplicate: () => void
}

export function ActionsTab({
  chartId,
  customization,
  onUpdate,
  onExport,
  onDuplicate
}: ActionsTabProps) {
  return (
    <div className="space-y-4">
      {/* Export Options */}
      <div>
        <label className="text-sm font-medium mb-2 block">Export Chart</label>
        <div className="grid grid-cols-3 gap-2">
          {EXPORT_FORMATS.map(format => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              onClick={() => onExport(format)}
              className="text-xs flex items-center justify-center uppercase"
            >
              <Download className="h-3 w-3 mr-1" />
              {format}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart Actions */}
      <div>
        <label className="text-sm font-medium mb-2 block">Chart Actions</label>
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicate}
            className="w-full justify-start text-xs"
          >
            <Copy className="h-3 w-3 mr-2" />
            Duplicate Chart
          </Button>
        </div>
      </div>

      {/* Advanced Options */}
      <div>
        <label className="text-sm font-medium mb-2 block">Advanced</label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Animation</span>
            <button
              onClick={() => onUpdate({ animate: !(customization as any)?.animate })}
              className={cn(
                'w-8 h-4 rounded-full transition-colors relative',
                (customization as any)?.animate ? 'bg-primary' : 'bg-gray-300'
              )}
            >
              <div
                className={cn(
                  'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform',
                  (customization as any)?.animate ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Interactive</span>
            <button
              onClick={() => onUpdate({ interactive: !(customization as any)?.interactive })}
              className={cn(
                'w-8 h-4 rounded-full transition-colors relative',
                (customization as any)?.interactive !== false ? 'bg-primary' : 'bg-gray-300'
              )}
            >
              <div
                className={cn(
                  'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform',
                  (customization as any)?.interactive !== false ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
