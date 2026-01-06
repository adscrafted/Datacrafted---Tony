'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, CreditCard, Settings, Shield } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { MinimalHeader } from '@/components/ui/minimal-header'

const navigation = [
  { name: 'Profile', href: '/account/profile', icon: User },
  { name: 'Billing', href: '/account/billing', icon: CreditCard },
  { name: 'Preferences', href: '/account/preferences', icon: Settings },
  { name: 'Privacy', href: '/account/privacy', icon: Shield },
]

function AccountLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <MinimalHeader showNavigation={true} />

      {/* Page Title Section */}
      <div className="py-12 px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-light text-gray-900 text-center">Account Settings</h1>
        </div>
      </div>

      {/* Minimal Navigation */}
      <div className="px-8 pb-16">
        <div className="max-w-4xl mx-auto">
          <nav className="flex justify-center space-x-12 mb-16">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center space-y-2 group transition-opacity hover:opacity-70",
                    isActive ? 'opacity-100' : 'opacity-60'
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-full transition-colors",
                    isActive
                      ? 'bg-gray-100'
                      : 'group-hover:bg-gray-50'
                  )}>
                    <item.icon className="h-5 w-5 text-gray-700" />
                  </div>
                  <span className="text-sm font-light text-gray-700">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* Main content */}
          <main className="max-w-2xl mx-auto">
            <div className="bg-white">
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