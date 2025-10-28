import React from 'react'
import type { CustomDotProps } from '../types'

// Custom dot component with onClick support for Line charts
export const CustomActiveDot: React.FC<CustomDotProps> = ({ cx, cy, fill, r = 4, payload, onClick }) => {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null

  return (
    <>
      {/* Invisible larger click area for better UX */}
      <circle
        cx={cx}
        cy={cy}
        r={r * 2}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation()
          if (onClick && payload) {
            console.log('🎯 Chart point clicked:', payload)
            onClick(payload)
          }
        }}
      />
      {/* Visible dot */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={fill}
        strokeWidth={2}
        strokeOpacity={0.8}
        fillOpacity={0.9}
        style={{ cursor: 'pointer', pointerEvents: 'none' }}
      />
    </>
  )
}
