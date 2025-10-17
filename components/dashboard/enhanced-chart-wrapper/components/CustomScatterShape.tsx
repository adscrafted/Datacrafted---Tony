import React from 'react'
import { CustomScatterShapeProps } from '../types'

// Custom shape component for Scatter charts
export const CustomScatterShape: React.FC<CustomScatterShapeProps> = ({ cx, cy, fill, payload, onClick }) => {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null

  return (
    <circle
      cx={cx}
      cy={cy}
      r={6}
      fill={fill}
      fillOpacity={0.6}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        if (onClick && payload) {
          onClick(payload)
        }
      }}
    />
  )
}
