'use client'

import { useRouter } from 'next/navigation'
import type { User } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { BarChart3, LogOut } from 'lucide-react'

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
              {/* User Info */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-2 rounded-lg bg-transparent">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#71b2ff] to-[#3cf152] flex items-center justify-center text-white text-sm font-medium">
                  {user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>

              {/* Go to Dashboard Button */}
              <Button
                onClick={() => router.push('/projects')}
                className="bg-gradient-to-r from-[#71b2ff] to-[#3cf152] hover:opacity-90 text-white font-medium px-6 py-2 rounded-lg transition-all duration-200"
                style={{ fontFamily: "'Google Sans Text', Helvetica, Arial, sans-serif" }}
              >
                Go to Dashboard
              </Button>

              {/* Logout Button */}
              <Button
                onClick={onLogout}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-gray-700 hover:bg-[#f0f3f8]"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
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
