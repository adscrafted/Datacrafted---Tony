'use client'

import React, { useState } from 'react'
import { Download, Share2, Link, Copy, FileImage, FileText, Database, QrCode, Mail, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/store'
import { useChartStore } from '@/lib/stores/chart-store'
import { useSessionStore } from '@/lib/stores/session-store'

interface ExportSharePanelProps {
  className?: string
}

type ExportFormat = 'png' | 'pdf' | 'svg' | 'json' | 'csv' | 'xlsx'
type ShareMethod = 'link' | 'embed' | 'email' | 'qr'

const exportFormats = [
  {
    format: 'png' as ExportFormat,
    label: 'PNG Image',
    description: 'High-quality image file',
    icon: FileImage,
    category: 'image'
  },
  {
    format: 'pdf' as ExportFormat,
    label: 'PDF Document',
    description: 'Printable document',
    icon: FileText,
    category: 'document'
  },
  {
    format: 'svg' as ExportFormat,
    label: 'SVG Vector',
    description: 'Scalable vector graphics',
    icon: FileImage,
    category: 'image'
  },
  {
    format: 'json' as ExportFormat,
    label: 'JSON Data',
    description: 'Raw data and settings',
    icon: Database,
    category: 'data'
  },
  {
    format: 'csv' as ExportFormat,
    label: 'CSV File',
    description: 'Spreadsheet compatible',
    icon: Database,
    category: 'data'
  },
  {
    format: 'xlsx' as ExportFormat,
    label: 'Excel File',
    description: 'Microsoft Excel format',
    icon: Database,
    category: 'data'
  }
]

const shareOptions = [
  {
    method: 'link' as ShareMethod,
    label: 'Shareable Link',
    description: 'Generate a public link',
    icon: Link
  },
  {
    method: 'embed' as ShareMethod,
    label: 'Embed Code',
    description: 'HTML code for websites',
    icon: Copy
  },
  {
    method: 'email' as ShareMethod,
    label: 'Send via Email',
    description: 'Email dashboard link',
    icon: Mail
  },
  {
    method: 'qr' as ShareMethod,
    label: 'QR Code',
    description: 'Generate QR code',
    icon: QrCode
  }
]

export function ExportSharePanel({ className }: ExportSharePanelProps) {
  // Modular store migration
  const currentSession = useSessionStore((state) => state.currentSession)
  const currentTheme = useChartStore((state) => state.currentTheme)
  const currentLayout = useChartStore((state) => state.currentLayout)
  const chartCustomizations = useChartStore((state) => state.chartCustomizations)
  const dashboardFilters = useChartStore((state) => state.dashboardFilters)

  // Functions still in monolithic store (to be migrated later)
  const { exportDashboard, exportSession, generateShareableLink } = useDataStore()

  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'export' | 'share'>('export')
  const [isExporting, setIsExporting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [embedCode, setEmbedCode] = useState<string | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true)
    setError(null)
    setExportSuccess(null)

    try {
      if (format === 'json' || format === 'csv' || format === 'xlsx') {
        await exportSession(format as 'json' | 'csv')
      } else {
        await exportDashboard(format as 'png' | 'pdf')
      }
      setExportSuccess(`Dashboard exported as ${format.toUpperCase()}`)
    } catch (err) {
      setError(`Failed to export dashboard: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleShare = async (method: ShareMethod) => {
    setIsGenerating(true)
    setError(null)

    try {
      switch (method) {
        case 'link':
          const url = await generateShareableLink()
          setShareUrl(url)
          break
        
        case 'embed':
          const embedUrl = await generateShareableLink()
          const iframe = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0"></iframe>`
          setEmbedCode(iframe)
          break
        
        case 'email':
          const emailUrl = await generateShareableLink()
          const subject = encodeURIComponent(`Dashboard: ${currentSession?.name || 'Data Analysis'}`)
          const body = encodeURIComponent(`Check out this interactive dashboard:\n\n${emailUrl}`)
          window.open(`mailto:?subject=${subject}&body=${body}`)
          break
        
        case 'qr':
          const qrUrl = await generateShareableLink()
          // Generate QR code using a service or library
          const qrCodeDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`
          setQrCodeUrl(qrCodeDataUrl)
          break
      }
    } catch (err) {
      setError(`Failed to generate share link: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setExportSuccess('Copied to clipboard!')
    } catch (err) {
      setError('Failed to copy to clipboard')
    }
  }

  const resetState = () => {
    setShareUrl(null)
    setEmbedCode(null)
    setQrCodeUrl(null)
    setExportSuccess(null)
    setError(null)
  }

  const hasCustomizations = Object.keys(chartCustomizations).length > 0 || 
                           dashboardFilters.length > 0 || 
                           currentTheme.name !== 'Default'

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) resetState()
        }}
        className="flex items-center space-x-2"
      >
        <Share2 className="h-4 w-4" />
        <span>Export & Share</span>
      </Button>
      
      {isOpen && (
        <Card className="absolute top-10 right-0 z-50 w-96 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              Export & Share Dashboard
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </CardTitle>
            
            {/* Tabs */}
            <div className="flex space-x-1 mt-2">
              <button
                onClick={() => setActiveTab('export')}
                className={cn(
                  'flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-xs rounded transition-colors',
                  activeTab === 'export'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                <Download className="h-3 w-3" />
                <span>Export</span>
              </button>
              <button
                onClick={() => setActiveTab('share')}
                className={cn(
                  'flex-1 flex items-center justify-center space-x-1 px-3 py-2 text-xs rounded transition-colors',
                  activeTab === 'share'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 hover:bg-gray-200'
                )}
              >
                <Share2 className="h-3 w-3" />
                <span>Share</span>
              </button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Status Messages */}
            {exportSuccess && (
              <div className="flex items-center space-x-2 p-2 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
                <Check className="h-4 w-4" />
                <span>{exportSuccess}</span>
              </div>
            )}
            
            {error && (
              <div className="flex items-center space-x-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  Export your dashboard in various formats
                </div>
                
                {/* Export Options by Category */}
                {['image', 'document', 'data'].map(category => (
                  <div key={category}>
                    <h4 className="text-sm font-medium mb-2 capitalize">{category} Formats</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {exportFormats
                        .filter(option => option.category === category)
                        .map(option => {
                          const Icon = option.icon
                          return (
                            <Button
                              key={option.format}
                              variant="outline"
                              size="sm"
                              onClick={() => handleExport(option.format)}
                              disabled={isExporting || !currentSession}
                              className="justify-start h-auto p-3"
                            >
                              <div className="flex items-center space-x-3 w-full">
                                <Icon className="h-4 w-4 text-muted-foreground" />
                                <div className="flex-1 text-left">
                                  <div className="font-medium text-sm">{option.label}</div>
                                  <div className="text-xs text-muted-foreground">{option.description}</div>
                                </div>
                              </div>
                            </Button>
                          )
                        })}
                    </div>
                  </div>
                ))}
                
                {!currentSession && (
                  <div className="text-xs text-muted-foreground p-2 bg-yellow-50 border border-yellow-200 rounded">
                    Save your dashboard first to enable exports
                  </div>
                )}
              </div>
            )}

            {/* Share Tab */}
            {activeTab === 'share' && (
              <div className="space-y-4">
                <div className="text-xs text-muted-foreground">
                  Share your dashboard with others
                </div>
                
                {/* Share Options */}
                <div className="grid grid-cols-1 gap-2">
                  {shareOptions.map(option => {
                    const Icon = option.icon
                    return (
                      <Button
                        key={option.method}
                        variant="outline"
                        size="sm"
                        onClick={() => handleShare(option.method)}
                        disabled={isGenerating || !currentSession}
                        className="justify-start h-auto p-3"
                      >
                        <div className="flex items-center space-x-3 w-full">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 text-left">
                            <div className="font-medium text-sm">{option.label}</div>
                            <div className="text-xs text-muted-foreground">{option.description}</div>
                          </div>
                        </div>
                      </Button>
                    )
                  })}
                </div>
                
                {/* Share Results */}
                {shareUrl && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Shareable Link:</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-50"
                      />
                      <Button
                        size="sm"
                        onClick={() => copyToClipboard(shareUrl)}
                        className="px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {embedCode && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Embed Code:</label>
                    <div className="flex space-x-2">
                      <textarea
                        value={embedCode}
                        readOnly
                        rows={3}
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-50 resize-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => copyToClipboard(embedCode)}
                        className="px-2"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {qrCodeUrl && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">QR Code:</label>
                    <div className="flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32 border rounded" />
                    </div>
                  </div>
                )}
                
                {!currentSession && (
                  <div className="text-xs text-muted-foreground p-2 bg-yellow-50 border border-yellow-200 rounded">
                    Save your dashboard first to enable sharing
                  </div>
                )}
              </div>
            )}
            
            {/* Dashboard Info */}
            {currentSession && hasCustomizations && (
              <div className="pt-4 border-t space-y-2">
                <div className="text-xs font-medium">Dashboard includes:</div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {Object.keys(chartCustomizations).length > 0 && (
                    <div>• {Object.keys(chartCustomizations).length} customized charts</div>
                  )}
                  {dashboardFilters.length > 0 && (
                    <div>• {dashboardFilters.length} active filters</div>
                  )}
                  {currentTheme.name !== 'Default' && (
                    <div>• Custom theme: {currentTheme.name}</div>
                  )}
                  {currentLayout.name !== 'Default Layout' && (
                    <div>• Custom layout: {currentLayout.name}</div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}