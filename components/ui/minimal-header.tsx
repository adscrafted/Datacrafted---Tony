'use client'

import { BarChart3, LogOut, CreditCard, User, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white text-sm font-medium">
                      {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="hidden sm:inline text-sm font-medium text-gray-700">
                      {user.displayName || user.email?.split('@')[0]}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="flex items-center cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/billing" className="flex items-center cursor-pointer">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}