import React from 'react'
import { CustomDotProps } from '../types'

// Custom dot component with onClick support for Line charts
export const CustomActiveDot: React.FC<CustomDotProps> = ({ cx, cy, fill, r = 4, payload, onClick }) => {
  if (typeof cx !== 'number' || typeof cy !== 'number') return null

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
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
