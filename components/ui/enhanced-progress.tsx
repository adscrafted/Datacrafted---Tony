'use client'

import React from 'react'
import { Loader2, CheckCircle2, AlertTriangle, Activity } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { transitions, durations, prefersReducedMotion } from '@/lib/utils/animations'

export interface ProgressStage {
  id: string
  label: string
  status: 'pending' | 'active' | 'completed' | 'error'
  progress?: number
  details?: string
  estimatedTime?: number
}

interface EnhancedProgressProps {
  stages: ProgressStage[]
  currentStage?: string
  overallProgress: number
  className?: string
  showDetails?: boolean
  animated?: boolean
  variant?: 'default' | 'minimal' | 'detailed'
}

export function EnhancedProgress({
  stages,
  currentStage,
  overallProgress,
  className,
  showDetails = true,
  animated = true,
  variant = 'default'
}: EnhancedProgressProps) {
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
  }

  const getStageIcon = (stage: ProgressStage) => {
    switch (stage.status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'active':
        return <Loader2 className={cn("h-4 w-4 text-primary", animated && "animate-spin")} />
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />
    }
  }

  if (variant === 'minimal') {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between text-sm">
          <span>Processing...</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={cn(
              "bg-primary h-2 rounded-full transition-all duration-300",
              animated && "ease-out"
            )}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Overall Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Overall Progress</span>
          <span className="text-muted-foreground">{Math.round(overallProgress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className={cn(
              "bg-primary h-3 rounded-full",
              animated && !prefersReducedMotion() ? "transition-all duration-500 ease-out" : "",
              overallProgress === 100 && "bg-green-500"
            )}
            style={{ 
              width: `${overallProgress}%`,
              transition: animated && !prefersReducedMotion() 
                ? `width ${durations.slow}ms cubic-bezier(0.4, 0, 0.2, 1)` 
                : undefined
            }}
          />
        </div>
      </div>

      {/* Stage Breakdown */}
      {variant === 'detailed' && (
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const isActive = stage.status === 'active' || stage.id === currentStage
            const isCompleted = stage.status === 'completed'
            const hasError = stage.status === 'error'

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center space-x-3 p-2 rounded-lg",
                  !prefersReducedMotion() && "transition-all duration-200 ease-in-out",
                  isActive && "bg-primary/5 border border-primary/20 scale-[1.02]",
                  isCompleted && "bg-green-50 border border-green-200",
                  hasError && "bg-red-50 border border-red-200"
                )}
                style={{
                  transform: isActive && !prefersReducedMotion() ? 'scale(1.02)' : 'scale(1)',
                  transition: !prefersReducedMotion() 
                    ? `all ${durations.fast}ms cubic-bezier(0.4, 0, 0.2, 1)` 
                    : undefined
                }}
              >
                <div className="flex-shrink-0">
                  {getStageIcon(stage)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isActive && "text-primary",
                      isCompleted && "text-green-700",
                      hasError && "text-red-700"
                    )}>
                      {stage.label}
                    </p>
                    
                    {stage.progress !== undefined && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {Math.round(stage.progress)}%
                      </span>
                    )}
                  </div>
                  
                  {showDetails && (stage.details || stage.estimatedTime) && (
                    <div className="flex items-center justify-between mt-1">
                      {stage.details && (
                        <p className="text-xs text-muted-foreground truncate">
                          {stage.details}
                        </p>
                      )}
                      {stage.estimatedTime && stage.estimatedTime > 1000 && (
                        <p className="text-xs text-muted-foreground">
                          ~{formatTime(stage.estimatedTime)} remaining
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Individual stage progress bar */}
                  {stage.progress !== undefined && stage.status === 'active' && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                      <div 
                        className={cn(
                          "bg-primary h-1 rounded-full",
                          animated && !prefersReducedMotion() && "ease-out"
                        )}
                        style={{ 
                          width: `${stage.progress}%`,
                          transition: animated && !prefersReducedMotion() 
                            ? `width ${durations.normal}ms cubic-bezier(0.4, 0, 0.2, 1)` 
                            : undefined
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Performance Indicator */}
      {variant === 'detailed' && showDetails && (
        <div className="flex items-center space-x-2 text-xs text-muted-foreground bg-gray-50 p-2 rounded">
          <Activity className="h-3 w-3" />
          <span>Processing performance optimized for your file size</span>
        </div>
      )}
    </div>
  )
}

// Convenience hook for managing progress stages
export function useProgressStages() {
  const [stages, setStages] = React.useState<ProgressStage[]>([])
  const [currentStage, setCurrentStage] = React.useState<string>('')
  const [overallProgress, setOverallProgress] = React.useState(0)

  const initializeStages = React.useCallback((initialStages: Omit<ProgressStage, 'status'>[]) => {
    setStages(initialStages.map(stage => ({ ...stage, status: 'pending' as const })))
    setCurrentStage('')
    setOverallProgress(0)
  }, [])

  const updateStage = React.useCallback((stageId: string, updates: Partial<ProgressStage>) => {
    setStages(prev => prev.map(stage => 
      stage.id === stageId ? { ...stage, ...updates } : stage
    ))
    
    if (updates.status === 'active') {
      setCurrentStage(stageId)
    }
  }, [])

  const completeStage = React.useCallback((stageId: string) => {
    updateStage(stageId, { status: 'completed', progress: 100 })
  }, [updateStage])

  const errorStage = React.useCallback((stageId: string, error: string) => {
    updateStage(stageId, { status: 'error', details: error })
  }, [updateStage])

  const calculateOverallProgress = React.useCallback(() => {
    if (stages.length === 0) return 0
    
    const completedStages = stages.filter(s => s.status === 'completed').length
    const activeStage = stages.find(s => s.status === 'active')
    const activeProgress = activeStage?.progress || 0
    
    const baseProgress = (completedStages / stages.length) * 100
    const activeStageContribution = activeProgress / stages.length
    
    return Math.min(100, baseProgress + activeStageContribution)
  }, [stages])

  React.useEffect(() => {
    setOverallProgress(calculateOverallProgress())
  }, [calculateOverallProgress])

  return {
    stages,
    currentStage,
    overallProgress,
    initializeStages,
    updateStage,
    completeStage,
    errorStage
  }
}