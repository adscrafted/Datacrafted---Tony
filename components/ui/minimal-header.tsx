'use client'

import { BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface MinimalHeaderProps {
  showNavigation?: boolean
  className?: string
}

export function MinimalHeader({ showNavigation = false, className }: MinimalHeaderProps) {
  return (
    <header className={cn("py-8", className)}>
      <div className="container mx-auto px-8">
        <div className="flex items-center justify-between">
          {/* Logo - Always centered when no navigation, left-aligned when navigation exists */}
          <div className={cn(
            "flex items-center space-x-3",
            !showNavigation && "mx-auto"
          )}>
            <Link href="/" className="flex items-center space-x-3 group transition-all duration-200 hover:opacity-70">
              <BarChart3 className="h-7 w-7 text-gray-900 transition-transform duration-200 group-hover:scale-105" />
              <span className="text-2xl font-light text-gray-900">DataCrafted</span>
            </Link>
          </div>

          {/* Minimal Navigation - Only shows when requested */}
          {showNavigation && (
            <nav className="flex items-center space-x-8">
              <Link
                href="/projects"
                className="text-sm font-light text-gray-600 hover:text-gray-900 transition-all duration-200 px-3 py-2 rounded-full hover:bg-gray-50"
              >
                Projects
              </Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  )
}