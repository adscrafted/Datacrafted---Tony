'use client'

import { BarChart3, LogOut } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'

interface MinimalHeaderProps {
  showNavigation?: boolean
  className?: string
}

export function MinimalHeader({ showNavigation = false, className }: MinimalHeaderProps) {
  const { user, logout } = useAuth()

  return (
    <header className={cn("py-8", className)}>
      <div className="container mx-auto px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-3 group transition-all duration-200 hover:opacity-70">
              <BarChart3 className="h-7 w-7 text-gray-900 transition-transform duration-200 group-hover:scale-105" />
              <span className="text-2xl font-light text-gray-900">DataCrafted</span>
            </Link>
          </div>

          {/* Right side - Navigation and User Management */}
          <div className="flex items-center space-x-6">
            {/* Minimal Navigation */}
            {showNavigation && (
              <nav className="flex items-center space-x-4">
                <Link
                  href="/projects"
                  className="text-sm font-light text-gray-600 hover:text-gray-900 transition-all duration-200 px-3 py-2 rounded-full hover:bg-gray-50"
                >
                  Projects
                </Link>
              </nav>
            )}

            {/* User Management */}
            {user && (
              <div className="flex items-center space-x-3">
                {/* User Info */}
                <div className="hidden sm:flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white text-sm font-medium">
                    {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                </div>

                {/* Logout Button */}
                <Button
                  onClick={logout}
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}