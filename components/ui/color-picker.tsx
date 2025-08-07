'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { Button } from './button'
import { Card, CardContent } from './card'

interface ColorPickerProps {
  value?: string
  onChange?: (color: string) => void
  className?: string
  presetColors?: string[]
}

const defaultPresetColors = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D',
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
  '#ea580c', '#dc2626', '#84cc16', '#6366f1', '#ec4899', '#14b8a6'
]

export function ColorPicker({ 
  value = '#0088FE', 
  onChange, 
  className,
  presetColors = defaultPresetColors 
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [customColor, setCustomColor] = useState(value)

  const handleColorChange = (color: string) => {
    onChange?.(color)
    setIsOpen(false)
  }

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setCustomColor(color)
    onChange?.(color)
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-20 h-8 p-1 border-2"
        style={{ backgroundColor: value }}
      >
        <div className="w-full h-full rounded-sm border border-gray-300" />
      </Button>
      
      {isOpen && (
        <Card className="absolute top-10 left-0 z-50 w-64 shadow-lg">
          <CardContent className="p-4 space-y-4">
            {/* Preset Colors */}
            <div>
              <h4 className="text-sm font-medium mb-2">Preset Colors</h4>
              <div className="grid grid-cols-6 gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={cn(
                      'w-8 h-8 rounded border-2 hover:scale-110 transition-transform',
                      value === color ? 'border-gray-800' : 'border-gray-300'
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            {/* Custom Color */}
            <div>
              <h4 className="text-sm font-medium mb-2">Custom Color</h4>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={handleCustomColorChange}
                  className="w-12 h-8 border border-gray-300 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value)
                    if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
                      onChange?.(e.target.value)
                    }
                  }}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                  placeholder="#000000"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => handleColorChange(customColor)}>
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}