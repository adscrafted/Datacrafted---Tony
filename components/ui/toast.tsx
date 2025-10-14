'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        setIsExiting(true)
        setTimeout(() => onDismiss(toast.id), 300)
      }, toast.duration)

      return () => clearTimeout(timer)
    }
  }, [toast.duration, toast.id, onDismiss])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => onDismiss(toast.id), 300)
  }

  const Icon = toast.type === 'success' ? CheckCircle : toast.type === 'error' ? AlertCircle : toast.type === 'warning' ? AlertCircle : Info

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 bg-white rounded-lg shadow-lg border max-w-md w-full",
        "transition-all duration-300",
        isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0",
        toast.type === 'success' && "border-green-200",
        toast.type === 'error' && "border-red-200",
        toast.type === 'warning' && "border-yellow-200",
        toast.type === 'info' && "border-blue-200"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 flex-shrink-0 mt-0.5",
          toast.type === 'success' && "text-green-600",
          toast.type === 'error' && "text-red-600",
          toast.type === 'warning' && "text-yellow-600",
          toast.type === 'info' && "text-blue-600"
        )}
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900">{toast.message}</p>

        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-md transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // Listen for custom toast events
    const handleToastEvent = (event: CustomEvent<Toast>) => {
      setToasts(prev => [...prev, event.detail])
    }

    window.addEventListener('show-toast' as any, handleToastEvent)
    return () => window.removeEventListener('show-toast' as any, handleToastEvent)
  }, [])

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <div className="flex flex-col gap-2 pointer-events-auto">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </div>
  )
}

// Toast API
export const toast = {
  show: (message: string, type: ToastType = 'info', options?: { duration?: number; action?: Toast['action'] }) => {
    const toastEvent = new CustomEvent('show-toast', {
      detail: {
        id: `toast-${Date.now()}-${Math.random()}`,
        message,
        type,
        duration: options?.duration ?? 5000,
        action: options?.action
      }
    })
    window.dispatchEvent(toastEvent)
  },

  success: (message: string, options?: { duration?: number; action?: Toast['action'] }) => {
    toast.show(message, 'success', options)
  },

  error: (message: string, options?: { duration?: number; action?: Toast['action'] }) => {
    toast.show(message, 'error', options)
  },

  warning: (message: string, options?: { duration?: number; action?: Toast['action'] }) => {
    toast.show(message, 'warning', options)
  },

  info: (message: string, options?: { duration?: number; action?: Toast['action'] }) => {
    toast.show(message, 'info', options)
  }
}
