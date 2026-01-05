'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { BarChart3, LogOut, CreditCard, User as UserIcon, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface LandingHeaderProps {
  user: User | null
  onSignInClick: () => void
  onLogout: () => void
}

export function LandingHeader({ user, onSignInClick, onLogout }: LandingHeaderProps) {
  const router = useRouter()

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 shadow-none bg-transparent"
      style={{
        boxShadow: 'none',
        backgroundImage: 'none',
        transition: 'none'
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center relative" style={{ backgroundColor: 'transparent' }}>
        {/* Logo - Centered */}
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-[rgb(11,40,212)]" />
          <h1
            className="text-xl font-semibold tracking-tight text-[#1f1f1f]"
            style={{ fontFamily: "'Google Sans Text', Helvetica, Arial, sans-serif" }}
          >
            DataCrafted
          </h1>
        </div>

        {/* Auth Actions - Absolute positioned on right */}
        <div className="absolute right-6 flex items-center space-x-3">
          {user ? (
            <>
              {/* Go to Dashboard Button */}
              <Button
                onClick={() => router.push('/projects')}
                className="bg-gradient-to-r from-[#71b2ff] to-[#3cf152] hover:opacity-90 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200"
                style={{ fontFamily: "'Google Sans Text', Helvetica, Arial, sans-serif" }}
              >
                Go to Dashboard
              </Button>

              {/* User Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#71b2ff] to-[#3cf152] flex items-center justify-center text-white text-sm font-medium">
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
                      <UserIcon className="mr-2 h-4 w-4" />
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
                  <DropdownMenuItem onClick={onLogout} className="text-red-600 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button
              onClick={onSignInClick}
              className="bg-gradient-to-r from-[#71b2ff] to-[#3cf152] hover:opacity-90 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200"
              style={{ fontFamily: "'Google Sans Text', Helvetica, Arial, sans-serif" }}
            >
              Sign In
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
