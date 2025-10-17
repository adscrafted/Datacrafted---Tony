import React from 'react'
import { Database, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

interface UnconfiguredPlaceholderProps {
  id: string
  title: string
  isSelected: boolean
  className?: string
  onSelect?: (id: string) => void
  onEdit?: (id: string) => void
}

export const UnconfiguredPlaceholder: React.FC<UnconfiguredPlaceholderProps> = ({
  id,
  title,
  isSelected,
  className,
  onSelect,
  onEdit
}) => {
  return (
    <div
      className={cn(
        "h-full flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 transition-all",
        isSelected && "ring-2 ring-blue-500 border-blue-500",
        className
      )}
      onClick={() => onSelect?.(id)}
    >
      <Database className="h-16 w-16 text-gray-400 mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 text-center max-w-xs">
        Configure this chart&apos;s data mapping in the Data tab to visualize your data
      </p>
      <Button
        onClick={(e) => {
          e.stopPropagation()
          onEdit?.(id)
        }}
        size="sm"
        className="bg-blue-600 hover:bg-blue-700"
      >
        <Settings className="h-4 w-4 mr-2" />
        Configure Data
      </Button>
    </div>
  )
}
