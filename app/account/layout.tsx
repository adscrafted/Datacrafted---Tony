'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User, CreditCard, Users, ArrowLeft, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { useAuth } from '@/lib/contexts/auth-context'

const navigation = [
  { name: 'Profile', href: '/account/profile', icon: User },
  { name: 'Billing', href: '/account/billing', icon: CreditCard },
  { name: 'Team', href: '/account/team', icon: Users },
]

function AccountLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Account Settings</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/projects')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Projects</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-x-8">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      isActive
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-transparent text-gray-900 hover:bg-gray-50 hover:text-gray-900',
                      'group border-l-4 px-3 py-2 flex items-center text-sm font-medium'
                    )}
                  >
                    <item.icon
                      className={cn(
                        isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
                        'flex-shrink-0 -ml-1 mr-3 h-5 w-5'
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-9">
            <div className="bg-white shadow rounded-lg">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AccountLayoutContent>{children}</AccountLayoutContent>
    </ProtectedRoute>
  )
}