'use client'

import React from 'react'
import { Star, StarHalf, CheckCircle2, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'

/**
 * Quality factor breakdown from recommendation scoring
 */
export interface QualityFactors {
  dataTypeMatch: number      // 0-40
  columnConfidence: number    // 0-30
  userCorrectionBoost: number // 0-20
  clarityScore: number        // 0-10
}

/**
 * Props for QualityIndicator component
 */
export interface QualityIndicatorProps {
  /** Quality score (0-100) */
  score: number

  /** Optional breakdown of quality factors */
  factors?: QualityFactors

  /** Whether to show detailed breakdown on hover */
  showDetails?: boolean

  /** Size variant */
  size?: 'sm' | 'md' | 'lg'

  /** Whether this recommendation uses user corrections */
  usesUserCorrections?: boolean

  /** Additional CSS classes */
  className?: string
}

/**
 * Returns color class based on quality score
 */
function getQualityColor(score: number): {
  bg: string
  text: string
  border: string
} {
  if (score >= 75) {
    return {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200'
    }
  } else if (score >= 50) {
    return {
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200'
    }
  } else {
    return {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-200'
    }
  }
}

/**
 * Renders star rating based on quality score
 */
function StarRating({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const stars = Math.floor(score / 20) // 0-5 stars
  const hasHalfStar = (score % 20) >= 10

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }[size]

  const fullStars = Array.from({ length: stars }, (_, i) => (
    <Star key={`full-${i}`} className={cn(iconSize, 'fill-current')} />
  ))

  const halfStar = hasHalfStar ? (
    <StarHalf key="half" className={cn(iconSize, 'fill-current')} />
  ) : null

  const emptyStars = Array.from({ length: 5 - stars - (hasHalfStar ? 1 : 0) }, (_, i) => (
    <Star key={`empty-${i}`} className={cn(iconSize)} strokeWidth={2} />
  ))

  return (
    <div className="flex items-center gap-0.5">
      {fullStars}
      {halfStar}
      {emptyStars}
    </div>
  )
}

/**
 * Renders a progress bar for a quality factor
 */
function FactorBar({
  label,
  value,
  max,
  color
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const percentage = (value / max) * 100

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Quality breakdown tooltip content
 */
function QualityBreakdown({
  score,
  factors
}: {
  score: number
  factors?: QualityFactors
}) {
  if (!factors) {
    return (
      <div className="text-center py-2">
        <div className="text-lg font-bold mb-1">{score}/100</div>
        <div className="text-xs text-gray-500">Quality Score</div>
      </div>
    )
  }

  const total = factors.dataTypeMatch + factors.columnConfidence +
                factors.userCorrectionBoost + factors.clarityScore

  return (
    <div className="space-y-3 min-w-[280px]">
      <div className="text-center border-b border-gray-200 pb-2">
        <div className="text-2xl font-bold text-gray-900">{total}/100</div>
        <div className="text-xs text-gray-500 mt-0.5">Total Quality Score</div>
      </div>

      <div className="space-y-2.5">
        <FactorBar
          label="Data Type Match"
          value={factors.dataTypeMatch}
          max={40}
          color="bg-blue-500"
        />
        <FactorBar
          label="Column Confidence"
          value={factors.columnConfidence}
          max={30}
          color="bg-purple-500"
        />
        <FactorBar
          label="User Corrections"
          value={factors.userCorrectionBoost}
          max={20}
          color="bg-green-500"
        />
        <FactorBar
          label="Clarity"
          value={factors.clarityScore}
          max={10}
          color="bg-orange-500"
        />
      </div>

      <div className="pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>How well data types match the chart</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Confidence in column detection</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Uses your corrected columns</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Simplicity and clarity</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Quality Indicator Component
 *
 * Displays a visual quality score indicator with optional detailed breakdown.
 * Shows star rating, numeric score, and optionally user correction badges.
 *
 * @example
 * ```tsx
 * <QualityIndicator
 *   score={85}
 *   factors={qualityFactors}
 *   usesUserCorrections={true}
 *   showDetails={true}
 * />
 * ```
 */
export function QualityIndicator({
  score,
  factors,
  showDetails = true,
  size = 'md',
  usesUserCorrections = false,
  className
}: QualityIndicatorProps) {
  const colors = getQualityColor(score)

  const sizeClasses = {
    sm: {
      container: 'px-2 py-1 gap-1.5',
      text: 'text-xs',
      badge: 'text-[10px] px-1.5 py-0.5'
    },
    md: {
      container: 'px-3 py-1.5 gap-2',
      text: 'text-sm',
      badge: 'text-xs px-2 py-0.5'
    },
    lg: {
      container: 'px-4 py-2 gap-2.5',
      text: 'text-base',
      badge: 'text-sm px-2.5 py-1'
    }
  }[size]

  const content = (
    <div className={cn(
      'inline-flex items-center border rounded-md',
      colors.bg,
      colors.border,
      sizeClasses.container,
      className
    )}>
      <StarRating score={score} size={size} />
      <span className={cn('font-semibold', colors.text, sizeClasses.text)}>
        {score}
      </span>

      {usesUserCorrections && (
        <Badge
          variant="outline"
          className={cn(
            'ml-1 bg-green-50 text-green-700 border-green-200',
            sizeClasses.badge
          )}
        >
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Your Corrections
        </Badge>
      )}
    </div>
  )

  if (!showDetails || !factors) {
    return content
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-4">
          <QualityBreakdown score={score} factors={factors} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compact quality badge for chart headers
 */
export function QualityBadge({
  score,
  className
}: {
  score: number
  className?: string
}) {
  const colors = getQualityColor(score)
  const stars = Math.floor(score / 20)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border cursor-help',
            colors.bg,
            colors.border,
            className
          )}>
            <TrendingUp className={cn('w-3 h-3', colors.text)} />
            <span className={cn('text-xs font-medium', colors.text)}>
              {score}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div className="text-center">
            <StarRating score={score} size="sm" />
            <div className="text-xs mt-1">Quality: {score}/100</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Average quality display for dashboard summary
 */
export function AverageQualityIndicator({
  scores,
  className
}: {
  scores: number[]
  className?: string
}) {
  if (scores.length === 0) {
    return null
  }

  const avgScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
  const colors = getQualityColor(avgScore)

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-2 rounded-lg border',
      colors.bg,
      colors.border,
      className
    )}>
      <div className="flex flex-col items-start">
        <span className="text-xs text-gray-600">Avg Quality</span>
        <div className="flex items-center gap-1.5">
          <StarRating score={avgScore} size="sm" />
          <span className={cn('text-sm font-bold', colors.text)}>
            {avgScore}
          </span>
        </div>
      </div>
      <div className={cn('text-xs', colors.text)}>
        {scores.length} chart{scores.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}