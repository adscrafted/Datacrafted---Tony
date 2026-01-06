'use client'

import React, { useState } from 'react'
import { useAuth } from '@/lib/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Download, Trash2, AlertTriangle, Shield, Database, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export default function PrivacyPage() {
  const { user, logout, isDebugMode } = useAuth()
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [exportError, setExportError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleExportData = async () => {
    setIsExporting(true)
    setExportSuccess(false)
    setExportError('')

    try {
      if (isDebugMode) {
        // In debug mode, create sample export data
        const sampleData = {
          account: {
            email: user?.email,
            displayName: user?.displayName,
            createdAt: user?.metadata?.creationTime,
          },
          projects: [],
          preferences: JSON.parse(localStorage.getItem('userPreferences') || '{}'),
          exportedAt: new Date().toISOString(),
        }

        const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `datacrafted-export-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        setExportSuccess(true)
        setTimeout(() => setExportSuccess(false), 3000)
      } else {
        // Production: Call API to get full data export
        const token = await user?.getIdToken()
        const response = await fetch('/api/user/export', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to export data')
        }

        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `datacrafted-export-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        setExportSuccess(true)
        setTimeout(() => setExportSuccess(false), 3000)
      }
    } catch (error) {
      console.error('Failed to export data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to export data'
      setExportError(errorMessage)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm')
      return
    }

    setIsDeleting(true)
    setDeleteError('')

    try {
      if (isDebugMode) {
        // In debug mode, simulate deletion
        console.log('Debug mode: Account would be deleted')
        await logout()
        router.push('/')
      } else {
        // Production: Call API to delete account
        const token = await user?.getIdToken()
        const response = await fetch('/api/user', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to delete account')
        }

        // Sign out and redirect
        await logout()
        router.push('/')
      }
    } catch (error) {
      console.error('Failed to delete account:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete account'
      setDeleteError(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div>
      <CardHeader>
        <CardTitle>Data & Privacy</CardTitle>
        <CardDescription>
          Manage your data and privacy settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Debug Mode Notice */}
        {isDebugMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              Debug Mode Active - Some features are simulated
            </p>
          </div>
        )}

        {/* Your Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Your Data</CardTitle>
            </div>
            <CardDescription>
              Information about what data we store
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start space-x-3">
                <FileText className="h-4 w-4 mt-0.5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">Account Information</p>
                  <p>Email address, display name, and profile settings</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FileText className="h-4 w-4 mt-0.5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">Projects & Analyses</p>
                  <p>Your uploaded data, charts, and AI analysis results</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FileText className="h-4 w-4 mt-0.5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">Usage Data</p>
                  <p>Analysis counts and feature usage for your account</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Download className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">Export Your Data</CardTitle>
            </div>
            <CardDescription>
              Download a copy of all your data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Export all your account data, projects, and settings in JSON format.
              This includes your profile information, all projects, and preferences.
            </p>
            <Button
              onClick={handleExportData}
              disabled={isExporting}
              variant="outline"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing Export...
                </>
              ) : exportSuccess ? (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Downloaded!
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export All Data
                </>
              )}
            </Button>
            {exportError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-600">{exportError}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card>
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-purple-500" />
              <CardTitle className="text-lg">Data Retention</CardTitle>
            </div>
            <CardDescription>
              How long we keep your data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <p>
                <span className="font-medium text-gray-900">Active accounts:</span>{' '}
                Data is retained as long as your account is active.
              </p>
              <p>
                <span className="font-medium text-gray-900">Deleted projects:</span>{' '}
                Removed immediately from our systems.
              </p>
              <p>
                <span className="font-medium text-gray-900">Account deletion:</span>{' '}
                All data is permanently deleted within 30 days.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <CardTitle className="text-lg text-red-600">Delete Account</CardTitle>
            </div>
            <CardDescription>
              Permanently delete your account and all data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div className="text-sm text-red-700">
                  <p className="font-medium mb-1">This action cannot be undone</p>
                  <p>
                    Deleting your account will permanently remove all your projects,
                    analyses, and settings. Your subscription will be canceled immediately.
                  </p>
                </div>
              </div>
            </div>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete My Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-red-600">Delete Account</DialogTitle>
                  <DialogDescription>
                    This will permanently delete your account and all associated data.
                    This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="delete-confirm">
                      Type <span className="font-mono font-bold">DELETE</span> to confirm
                    </Label>
                    <Input
                      id="delete-confirm"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      placeholder="DELETE"
                      className="font-mono"
                    />
                  </div>

                  {deleteError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-600">{deleteError}</p>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowDeleteDialog(false)
                      setDeleteConfirmation('')
                      setDeleteError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmation !== 'DELETE'}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete Forever'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </CardContent>
    </div>
  )
}
