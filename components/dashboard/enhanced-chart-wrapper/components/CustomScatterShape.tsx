import React from 'react'
import type { CustomScatterShapeProps } from '../types'

// Custom shape component for Scatter charts
export const CustomScatterShape: React.FC<CustomScatterShapeProps> = ({ cx, cy, fill, payload, onClick }) => {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null

  return (
    <>
      {/* Invisible larger click area for better UX */}
      <circle
        cx={cx}
        cy={cy}
        r={12}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          console.log('🎯 Scatter point clicked:', payload)
          if (onClick && payload) {
            onClick(payload)
          }
        }}
      />
      {/* Visible dot */}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={fill}
        fillOpacity={0.6}
        stroke={fill}
        strokeWidth={1}
        style={{ cursor: 'pointer', pointerEvents: 'none' }}
      />
    </>
  )
}
