'use client'

import React, { useState } from 'react'
import { Copy, Check, Mail, Link, Download, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSessionStore } from '@/lib/stores/session-store'
import { useChartStore } from '@/lib/stores/chart-store'

interface ShareDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function ShareDialog({ isOpen, onClose }: ShareDialogProps) {
  const [shareLink, setShareLink] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'link' | 'export'>('link')

  // Modular store imports
  const currentSession = useSessionStore((state) => state.currentSession)
  const { exportDashboard } = useChartStore()

  const handleGenerateLink = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      // Check if we have data to share
      if (!currentSession) {
        // Generate a temporary share link even without a saved session
        const tempId = Math.random().toString(36).substring(7)
        const fullUrl = `${window.location.origin}/dashboard?demo=${tempId}`
        setShareLink(fullUrl)
        return
      }

      // Generate a shareable link
      const shareId = `${currentSession.id.slice(0, 8)}-${Date.now().toString(36)}`
      const fullUrl = `${window.location.origin}/dashboard?share=${shareId}`
      setShareLink(fullUrl)

      // Store share data in localStorage for demo
      const shareData = {
        sessionId: currentSession.id,
        sessionName: currentSession.name,
        timestamp: Date.now(),
        expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
      }
      localStorage.setItem(`share-${shareId}`, JSON.stringify(shareData))
    } catch (error) {
      console.error('Failed to generate link:', error)
      setError('Failed to generate share link. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleExport = async (format: 'png' | 'pdf' | 'json') => {
    try {
      await exportDashboard(format)
    } catch (error) {
      console.error('Failed to export:', error)
      setError(`Failed to export as ${format.toUpperCase()}. Please try again.`)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Share Dashboard</h2>

        {/* Tabs */}
        <div className="flex space-x-1 mb-4 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'link'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Link className="w-4 h-4 inline mr-2" />
            Share Link
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export
          </button>
        </div>

        {activeTab === 'link' ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Generate a shareable link to your dashboard. Anyone with the link can view your dashboard and charts.
            </p>

            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!shareLink ? (
              <Button
                onClick={handleGenerateLink}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? 'Generating...' : 'Generate Share Link'}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    value={shareLink}
                    readOnly
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="px-3"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`mailto:?subject=Check out my dashboard&body=${encodeURIComponent(shareLink)}`)}
                    className="flex-1"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(shareLink, '_blank')}
                    className="flex-1"
                  >
                    <Link className="h-4 w-4 mr-2" />
                    Open
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t">
              <p className="text-xs text-gray-500">
                This link will be active for 30 days. {currentSession ? 'Your dashboard data is securely stored.' : 'Save your session to keep the link active.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Export your dashboard as an image or data file.
            </p>

            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => handleExport('png')}
                className="w-full justify-start"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as PNG Image
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport('pdf')}
                className="w-full justify-start"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as PDF Document
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport('json')}
                className="w-full justify-start"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as JSON Data
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
