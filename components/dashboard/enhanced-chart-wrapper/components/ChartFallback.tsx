import React from 'react'

interface ChartFallbackProps {
  message?: string
  submessage?: string
}

export const ChartFallback: React.FC<ChartFallbackProps> = ({
  message = 'No data available',
  submessage
}) => {
  return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <div className="text-center">
        <div className="text-sm">{message}</div>
        {submessage && <div className="text-xs mt-1">{submessage}</div>}
      </div>
    </div>
  )
}

export const ChartTooSmallFallback: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full text-gray-500">
      <div className="text-center space-y-2">
        <div className="text-sm font-medium">Chart too small</div>
        <div className="text-xs">Resize to view details</div>
      </div>
    </div>
  )
}
