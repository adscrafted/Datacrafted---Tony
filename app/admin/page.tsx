'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Database, RefreshCw, BarChart3, ShieldAlert, Loader2 } from 'lucide-react'
import { isAdmin } from '@/lib/config/admin'

interface DatabaseStats {
  sessions: {
    total: number
    active: number
    inactive: number
  }
  files: {
    total: number
    estimatedStorageBytes: number
    estimatedStorageMB: number
  }
  analyses: number
  chatMessages: number
  charts: number
  lastUpdated: string
}

interface CleanupStats {
  expiredSessionsCount: number
  orphanedFilesCount: number
  totalRecordsProcessed: number
  cleanupDuration: number
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DatabaseStats | null>(null)
  const [cleanupStats, setCleanupStats] = useState<CleanupStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunningCleanup, setIsRunningCleanup] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)

  // Check admin authorization
  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push('/auth/signin?redirect=/admin')
      return
    }

    if (!isAdmin(user.email)) {
      console.warn('[ADMIN] Unauthorized access attempt:', user.email)
      router.push('/dashboard')
      return
    }

    setIsAuthorized(true)
  }, [user, authLoading, router])

  const getAuthToken = async () => {
    if (!user) return null
    return user.getIdToken()
  }

  const loadStats = async () => {
    try {
      setError(null)
      const token = await getAuthToken()
      if (!token) return

      const response = await fetch('/api/admin/cleanup', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied - admin privileges required')
        }
        throw new Error('Failed to load stats')
      }
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      } else {
        throw new Error(data.error || 'Failed to load stats')
      }
    } catch (error) {
      console.error('Error loading stats:', error)
      setError(error instanceof Error ? error.message : 'Failed to load stats')
    } finally {
      setIsLoading(false)
    }
  }

  const runCleanup = async () => {
    try {
      setIsRunningCleanup(true)
      setError(null)

      const token = await getAuthToken()
      if (!token) return

      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Access denied - admin privileges required')
        }
        throw new Error('Cleanup request failed')
      }

      const data = await response.json()
      if (data.success) {
        setCleanupStats(data.stats)
        // Reload stats after cleanup
        await loadStats()
      } else {
        throw new Error(data.error || 'Cleanup failed')
      }
    } catch (error) {
      console.error('Error running cleanup:', error)
      setError(error instanceof Error ? error.message : 'Cleanup failed')
    } finally {
      setIsRunningCleanup(false)
    }
  }

  useEffect(() => {
    if (isAuthorized) {
      loadStats()
    }
  }, [isAuthorized])

  // Loading state
  if (authLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Verifying admin access...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">DataCrafted Admin</span>
            <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full flex items-center">
              <ShieldAlert className="h-3 w-3 mr-1" />
              Admin Only
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button onClick={() => router.push('/dashboard')} variant="outline">
              Back to App
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold">System Administration</h1>
            <p className="text-muted-foreground mt-2">
              Monitor system health and perform maintenance tasks
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              onClick={loadStats}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh Stats
            </Button>
            <Button
              onClick={runCleanup}
              disabled={isRunningCleanup}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isRunningCleanup ? 'Running Cleanup...' : 'Run Cleanup'}
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <p className="text-red-700 font-medium">Error</p>
                <p className="text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Cleanup Results */}
          {cleanupStats && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Cleanup Completed</CardTitle>
                <CardDescription className="text-green-700">
                  Cleanup finished in {cleanupStats.cleanupDuration}ms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-green-800">Expired Sessions</p>
                    <p className="text-green-700">{cleanupStats.expiredSessionsCount}</p>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Orphaned Files</p>
                    <p className="text-green-700">{cleanupStats.orphanedFilesCount}</p>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Total Processed</p>
                    <p className="text-green-700">{cleanupStats.totalRecordsProcessed}</p>
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Duration</p>
                    <p className="text-green-700">{cleanupStats.cleanupDuration}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Database Statistics */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Sessions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Database className="h-5 w-5 mr-2" />
                    Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span className="font-semibold">{stats.sessions.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active:</span>
                      <span className="font-semibold text-green-600">{stats.sessions.active}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inactive:</span>
                      <span className="font-semibold text-red-600">{stats.sessions.inactive}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Files */}
              <Card>
                <CardHeader>
                  <CardTitle>Files & Storage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Files:</span>
                      <span className="font-semibold">{stats.files.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Storage:</span>
                      <span className="font-semibold">{stats.files.estimatedStorageMB} MB</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content */}
              <Card>
                <CardHeader>
                  <CardTitle>Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Analyses:</span>
                      <span className="font-semibold">{stats.analyses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Charts:</span>
                      <span className="font-semibold">{stats.charts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Messages:</span>
                      <span className="font-semibold">{stats.chatMessages}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-muted-foreground">PostgreSQL with Prisma ORM</p>
                </div>
                <div>
                  <p className="font-medium">File Storage</p>
                  <p className="text-muted-foreground">Compressed in database</p>
                </div>
                <div>
                  <p className="font-medium">Session Management</p>
                  <p className="text-muted-foreground">Firebase Auth with JWT tokens</p>
                </div>
                <div>
                  <p className="font-medium">Last Updated</p>
                  <p className="text-muted-foreground">
                    {stats ? new Date(stats.lastUpdated).toLocaleString() : 'Loading...'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maintenance Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="font-medium text-blue-800">Regular Cleanup</p>
                  <p className="text-blue-700">
                    Run cleanup weekly to remove expired sessions and orphaned files
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="font-medium text-yellow-800">Storage Monitoring</p>
                  <p className="text-yellow-700">
                    Monitor file storage usage and implement retention policies as needed
                  </p>
                </div>
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="font-medium text-green-800">Performance</p>
                  <p className="text-green-700">
                    Database is optimized with proper indexes and foreign key constraints
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
