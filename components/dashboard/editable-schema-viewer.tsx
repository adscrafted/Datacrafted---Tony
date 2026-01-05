'use client'

import React, { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { Edit2, Save, X, Database, Key, Type, Hash, Calendar, CheckCircle, FileText, Brain, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/stores/data-store'
import { cn } from '@/lib/utils/cn'
import { auth } from '@/lib/config/firebase'

interface SchemaField {
  name: string
  type: string
  description?: string
  isPrimary?: boolean
  isRequired?: boolean
  confidence?: number
  detectionReason?: string
}

interface EditingField {
  index: number
  field: SchemaField
}

const dataTypes = [
  { value: 'string', label: 'String', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'boolean', label: 'Boolean', icon: CheckCircle },
  { value: 'text', label: 'Text', icon: FileText },
]

interface EditableSchemaViewerProps {
  onAIUpdateComplete?: () => void
}

export function EditableSchemaViewer({ onAIUpdateComplete }: EditableSchemaViewerProps = {}) {
  const rawData = useDataStore((state) => state.rawData)
  const dataSchema = useDataStore((state) => state.dataSchema)
  const setDataSchema = useDataStore((state) => state.setDataSchema)
  const setAnalysis = useDataStore((state) => state.setAnalysis)
  const setIsAnalyzing = useDataStore((state) => state.setIsAnalyzing)
  const setAnalysisProgress = useDataStore((state) => state.setAnalysisProgress)
  const setError = useDataStore((state) => state.setError)
  const isAnalyzing = useDataStore((state) => state.isAnalyzing)
  const setCorrectedSchema = useDataStore((state) => state.setCorrectedSchema)
  const correctedSchema = useDataStore((state) => state.correctedSchema)
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [editingField, setEditingField] = useState<EditingField | null>(null)
  const [isAddingField, setIsAddingField] = useState(false)
  const [newField, setNewField] = useState<SchemaField>({ name: '', type: 'string' })
  const [isPushingToAI, setIsPushingToAI] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    // First check if we have corrected schema stored from previous edits
    if (correctedSchema && correctedSchema.length > 0) {
      console.log('📋 [SCHEMA-VIEWER] Loading corrected schema from store:', correctedSchema.length, 'columns')
      const fields: SchemaField[] = correctedSchema.map((col) => ({
        name: col.name,
        type: col.type,
        description: col.description || '',
        isPrimary: false,
        isRequired: false,
        confidence: undefined,
        detectionReason: undefined,
      }))
      setSchema(fields)
    } else if (dataSchema?.columns) {
      // Initialize schema from dataSchema
      const fields: SchemaField[] = dataSchema.columns.map((col) => ({
        name: col.name,
        type: col.type,
        description: col.description || '',
        isPrimary: false,
        isRequired: col.nullPercentage === 0,
        confidence: col.confidence,
        detectionReason: col.detectionReason,
      }))
      setSchema(fields)
    } else if (rawData && rawData.length > 0) {
      // Generate basic schema from rawData
      const columns = Object.keys(rawData[0] || {})
      const fields: SchemaField[] = columns.map((columnName) => ({
        name: columnName,
        type: 'string', // Default to string
        description: '',
        isPrimary: false,
        isRequired: false,
      }))
      setSchema(fields)
    } else {
      setSchema([])
    }
  }, [dataSchema, rawData, correctedSchema])

  const handleEditField = (index: number) => {
    setEditingField({
      index,
      field: { ...schema[index] }
    })
  }

  const handleSaveField = () => {
    if (editingField) {
      const updatedSchema = [...schema]
      updatedSchema[editingField.index] = editingField.field
      setSchema(updatedSchema)
      setEditingField(null)
      setHasUnsavedChanges(true)

      // Also save to corrected schema store so edits persist
      const correctedFields = updatedSchema.map(field => ({
        name: field.name,
        type: field.type,
        description: field.description || '',
        userCorrected: true
      }))
      setCorrectedSchema(correctedFields)
      console.log('💾 [SCHEMA-VIEWER] Saved schema edits to store')
    }
  }

  const handlePushToAI = async () => {
    if (!rawData || rawData.length === 0) {
      console.error('No data available to push to AI')
      return
    }

    setIsPushingToAI(true)

    // Track timing for minimum loading duration
    const startTime = performance.now()
    const minimumLoadingDuration = 800 // ms - ensure user sees loading screen

    // CRITICAL: Use flushSync to force synchronous state updates
    // This ensures the dashboard sees the updated state immediately
    console.log('🔄 [PUSH-TO-AI] Flushing state updates synchronously')
    flushSync(() => {
      console.log('🔄 [PUSH-TO-AI] Clearing old analysis to show loading screen')
      setAnalysis(null)

      console.log('🔄 [PUSH-TO-AI] Setting isAnalyzing=true')
      setIsAnalyzing(true)

      console.log('🔄 [PUSH-TO-AI] Resetting progress to 0')
      setAnalysisProgress(0)
    })

    console.log('✅ [PUSH-TO-AI] State updates flushed - isAnalyzing should be true now')

    // Start progress simulation
    const progressInterval = setInterval(() => {
      // Get current progress from store (Zustand doesn't support functional updates)
      const currentProgress = useDataStore.getState().analysisProgress
      // Simulate progress with diminishing returns (slower as it approaches 99%)
      // Changed from 90% cap to 99% to prevent getting stuck
      const increment = Math.max(0.5, (99 - currentProgress) / 30)
      const newProgress = Math.min(99, currentProgress + increment)
      // Round to whole number for clean display
      setAnalysisProgress(Math.round(newProgress))
    }, 500) // Update every 500ms

    // Small delay to let progress interval start
    await new Promise(resolve => setTimeout(resolve, 50))

    // Navigate to dashboard - loading screen WILL show now because state is flushed
    console.log('🔄 [PUSH-TO-AI] Switching to dashboard view (state is guaranteed synced)')
    if (onAIUpdateComplete) {
      onAIUpdateComplete()
    }

    // Brief delay for view to switch
    await new Promise(resolve => setTimeout(resolve, 100))

    // Track API timing (needs to be outside try block for error handling)
    const apiStartTime = performance.now()

    try {
      console.log('⏱️ [PUSH-TO-AI] API call starting at:', apiStartTime)

      // Prepare the corrected schema information
      const correctedSchema = schema.map(field => ({
        name: field.name,
        type: field.type,
        description: field.description || '',
        userCorrected: true
      }))

      console.log('🔵 [PUSH-TO-AI] Sending corrected schema to AI:', {
        totalRows: rawData.length,
        sampleRows: Math.min(rawData.length, 100),
        correctedColumns: correctedSchema.length,
        fileName: dataSchema?.fileName
      })

      // Get Firebase auth token for API authentication
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('Authentication required. Please sign in to continue.')
      }

      let authToken: string | undefined
      try {
        authToken = await currentUser.getIdToken()
        console.log('✅ [PUSH-TO-AI] Got Firebase auth token for API request')
      } catch (authError) {
        throw new Error('Failed to get authentication token. Please try again.')
      }

      // Build headers with optional auth token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      // Send sample data (same as initial upload) with corrected schema
      // Prepare the request body
      const requestBody = {
        data: rawData.slice(0, 100), // Send sample (first 100 rows) just like initial upload
        schema: dataSchema, // Send current schema
        correctedSchema: correctedSchema,
        feedback: 'User has corrected column types and descriptions. Please re-analyze with this updated schema information.',
        fileName: dataSchema?.fileName || 'data.csv'
      }

      const bodyString = JSON.stringify(requestBody)
      const bodySizeKB = (new Blob([bodyString]).size / 1024).toFixed(2)

      console.log('🚀 [PUSH-TO-AI] About to send fetch request to /api/analyze')
      console.log('📦 [PUSH-TO-AI] Request body size:', bodySizeKB, 'KB')

      // Create AbortController for timeout
      const abortController = new AbortController()
      const timeout = setTimeout(() => {
        console.log('⏱️ [PUSH-TO-AI] Request timeout after 4.5 minutes, aborting...')
        abortController.abort()
      }, 270000) // 4.5 minute timeout (270 seconds) - slightly longer than API's 4 minutes to allow for network delays

      let response: Response
      try {
        console.log('🔄 [PUSH-TO-AI] Fetch starting...')
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers,
          body: bodyString,
          signal: abortController.signal
        })
        clearTimeout(timeout) // Clear timeout on successful fetch
        console.log('✅ [PUSH-TO-AI] Fetch completed without error')
      } catch (fetchError) {
        clearTimeout(timeout)
        console.error('❌ [PUSH-TO-AI] Network error during fetch:', fetchError)
        console.error('❌ [PUSH-TO-AI] Error type:', fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError)
        console.error('❌ [PUSH-TO-AI] Error name:', fetchError instanceof Error ? fetchError.name : 'N/A')
        console.error('❌ [PUSH-TO-AI] Error message:', fetchError instanceof Error ? fetchError.message : String(fetchError))

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('AI analysis timed out after 5 minutes. Please try again with a smaller dataset.')
        }
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
      }

      console.log('📡 [PUSH-TO-AI] Fetch completed, response status:', response.status, response.ok)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('❌ [PUSH-TO-AI] API error response:', errorData)

        // Handle paywall (402) response - show upgrade modal
        if (response.status === 402 && errorData.type === 'paywall') {
          console.log('💰 [PUSH-TO-AI] Paywall triggered:', errorData)
          // Import UI store and show paywall modal
          const { useUIStore } = await import('@/lib/stores/ui-store')
          useUIStore.getState().openPaywallModal('analysis', {
            used: errorData.usage?.used ?? 0,
            limit: errorData.usage?.limit ?? 3,
            plan: errorData.usage?.plan ?? 'free'
          })
          // Clear states without showing error toast
          clearInterval(progressInterval)
          setAnalysisProgress(0)
          setIsPushingToAI(false)
          setIsAnalyzing(false)
          return // Exit early - modal handles the UX
        }

        throw new Error(errorData.error || 'Failed to push to AI')
      }

      const result = await response.json()
      console.log('✅ [PUSH-TO-AI] Received AI analysis result:', {
        hasChartConfig: !!result.chartConfig,
        chartCount: result.chartConfig?.length || 0,
        hasInsights: !!result.insights
      })

      // Clear progress simulation and set to 100%
      clearInterval(progressInterval)
      setAnalysisProgress(100)

      // Update the analysis result in store
      if (result) {
        setAnalysis(result)
        console.log('✅ [PUSH-TO-AI] Analysis updated in store')
      }

      // CRITICAL: Persist correctedSchema to data-store so it can be used for future operations
      setCorrectedSchema(correctedSchema)
      console.log('✅ [PUSH-TO-AI] Corrected schema persisted to data-store:', correctedSchema.length, 'corrections')

      // CRITICAL: Clear all chart customizations so new AI analysis can be applied fresh
      // This ensures that user's old data mappings (from incorrect schema) don't override the new AI recommendations
      const { useChartStore } = await import('@/lib/stores/chart-store')
      const chartStore = useChartStore.getState()

      // Clear all existing customizations
      const chartIds = Object.keys(chartStore.chartCustomizations)
      if (chartIds.length > 0) {
        console.log('🧹 [PUSH-TO-AI] Clearing', chartIds.length, 'chart customizations to apply fresh AI analysis')
        chartIds.forEach(chartId => {
          chartStore.removeChartCustomization(chartId)
        })
      }

      // Update the dataSchema if AI provided additional insights
      if (result.schema) {
        setDataSchema({
          fileName: dataSchema?.fileName || 'data.csv',
          rowCount: dataSchema?.rowCount || rawData.length,
          columnCount: dataSchema?.columnCount || result.schema.columns.length,
          uploadedAt: dataSchema?.uploadedAt || new Date().toISOString(),
          columns: result.schema.columns,
          businessContext: result.businessContext,
          relationships: result.relationships
        })
        console.log('✅ [PUSH-TO-AI] DataSchema updated with AI insights')
      }

      setHasUnsavedChanges(false)
      const apiEndTime = performance.now()
      const apiDuration = apiEndTime - apiStartTime
      console.log('✅ [PUSH-TO-AI] AI analysis complete, dashboard will update automatically')
      console.log('⏱️ [PUSH-TO-AI] API call took:', apiDuration, 'ms')

      // Ensure minimum loading duration AFTER successful API call
      const elapsedTime = performance.now() - startTime
      const remainingTime = Math.max(0, minimumLoadingDuration - elapsedTime)
      if (remainingTime > 0) {
        console.log('⏱️ [PUSH-TO-AI] Waiting', remainingTime, 'ms to meet minimum loading duration')
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }

      // Cleanup after successful completion
      setIsPushingToAI(false)
      setIsAnalyzing(false)
      console.log('🧹 [PUSH-TO-AI] Cleanup: cleared states after', performance.now() - startTime, 'ms total')

    } catch (error) {
      // Clear progress simulation on error
      clearInterval(progressInterval)

      const apiEndTime = performance.now()
      const apiDuration = apiEndTime - apiStartTime
      console.error('❌ [PUSH-TO-AI] Error pushing to AI:', error)
      console.log('⏱️ [PUSH-TO-AI] API call failed after:', apiDuration, 'ms')

      // Reset progress to 0 on error to show that the operation failed
      setAnalysisProgress(0)

      // Set a more user-friendly error message based on the error type
      let errorMessage = 'Failed to push to AI'
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message.includes('abort')) {
          errorMessage = 'Request timed out. Please try again with a smaller dataset or simpler query.'
        } else {
          errorMessage = error.message
        }
      }
      setError(errorMessage)

      // Ensure minimum loading duration AFTER error
      const elapsedTime = performance.now() - startTime
      const remainingTime = Math.max(0, minimumLoadingDuration - elapsedTime)
      if (remainingTime > 0) {
        console.log('⏱️ [PUSH-TO-AI] Waiting', remainingTime, 'ms to meet minimum loading duration after error')
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }

      // Cleanup after error
      setIsPushingToAI(false)
      setIsAnalyzing(false)
      console.log('🧹 [PUSH-TO-AI] Cleanup after error, progress reset to 0')
    }
  }

  const handleCancelEdit = () => {
    setEditingField(null)
  }

  const handleAddField = () => {
    if (newField.name.trim()) {
      setSchema([...schema, newField])
      setNewField({ name: '', type: 'string' })
      setIsAddingField(false)
    }
  }

  const handleDeleteField = (index: number) => {
    setSchema(schema.filter((_, i) => i !== index))
  }

  const getTypeIcon = (type: string) => {
    const dataType = dataTypes.find(dt => dt.value === type)
    return dataType ? <dataType.icon className="h-3 w-3" /> : <Type className="h-3 w-3" />
  }

  const getConfidenceIcon = (confidence?: number) => {
    if (!confidence) return null

    if (confidence >= 80) {
      return <span title={`${confidence}% confidence`}><CheckCircle2 className="h-3 w-3 text-green-500" /></span>
    } else if (confidence >= 60) {
      return <span title={`${confidence}% confidence`}><AlertCircle className="h-3 w-3 text-yellow-500" /></span>
    } else {
      return <span title={`${confidence}% confidence`}><AlertCircle className="h-3 w-3 text-red-500" /></span>
    }
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-base">
              <Database className="h-4 w-4" />
              <span>Data Schema</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              {hasUnsavedChanges && (
                <span className="text-xs text-yellow-600">Unsaved changes</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePushToAI}
                disabled={isPushingToAI || !hasUnsavedChanges}
              >
                <Brain className="h-4 w-4 mr-2" />
                {isPushingToAI ? 'Pushing...' : 'Push to AI'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingField(true)}
                disabled={isAddingField}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Table View */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Field Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Confidence</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schema.map((field, index) => (
                  <tr
                    key={index}
                    className={cn(
                      "border-b transition-colors",
                      editingField?.index === index 
                        ? "bg-blue-50" 
                        : index % 2 === 0 
                          ? "bg-white hover:bg-gray-50" 
                          : "bg-gray-50/50 hover:bg-gray-50"
                    )}
                  >
                    {editingField?.index === index ? (
                      // Editing Mode
                      <>
                        <td className="px-4 py-2">
                          <Input
                            value={editingField.field.name}
                            onChange={(e) => setEditingField({
                              ...editingField,
                              field: { ...editingField.field, name: e.target.value }
                            })}
                            className="w-full text-sm"
                            placeholder="Field name"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Select
                            value={editingField.field.type}
                            onValueChange={(value) => setEditingField({
                              ...editingField,
                              field: { ...editingField.field, type: value }
                            })}
                          >
                            <SelectTrigger className="w-full text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dataTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div className="flex items-center space-x-2">
                                    <type.icon className="h-3 w-3" />
                                    <span className="text-sm">{type.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-1">
                            {getConfidenceIcon(editingField.field.confidence)}
                            <span className="text-xs text-gray-500">
                              {editingField.field.confidence ? `${editingField.field.confidence}%` : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            value={editingField.field.description || ''}
                            onChange={(e) => setEditingField({
                              ...editingField,
                              field: { ...editingField.field, description: e.target.value }
                            })}
                            className="w-full text-sm"
                            placeholder="Description (optional)"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleSaveField}
                              className="h-7 w-7 p-0"
                            >
                              <Save className="h-3 w-3 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="h-7 w-7 p-0"
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View Mode
                      <>
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-2">
                            {field.isPrimary && <Key className="h-3 w-3 text-yellow-600" />}
                            <span className="font-medium text-sm">{field.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-1">
                            {getTypeIcon(field.type)}
                            <span className="text-sm text-gray-600">{field.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-1">
                            {getConfidenceIcon(field.confidence)}
                            <span className="text-xs text-gray-500" title={field.detectionReason}>
                              {field.confidence ? `${field.confidence}%` : '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-sm text-gray-600">{field.description || '-'}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditField(index)}
                              className="h-7 w-7 p-0"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteField(index)}
                              className="h-7 w-7 p-0"
                            >
                              <X className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {/* Add New Field Form */}
                {isAddingField && (
                  <tr className="bg-green-50">
                    <td className="px-4 py-2">
                      <Input
                        value={newField.name}
                        onChange={(e) => setNewField({ ...newField, name: e.target.value })}
                        className="w-full text-sm"
                        placeholder="Field name"
                        autoFocus
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Select
                        value={newField.type}
                        onValueChange={(value) => setNewField({ ...newField, type: value })}
                      >
                        <SelectTrigger className="w-full text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dataTypes.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center space-x-2">
                                <type.icon className="h-3 w-3" />
                                <span className="text-sm">{type.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-gray-400">-</span>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        value={newField.description || ''}
                        onChange={(e) => setNewField({ ...newField, description: e.target.value })}
                        className="w-full text-sm"
                        placeholder="Description (optional)"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleAddField}
                          className="h-7 w-7 p-0"
                        >
                          <Save className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsAddingField(false)
                            setNewField({ name: '', type: 'string' })
                          }}
                          className="h-7 w-7 p-0"
                        >
                          <X className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Schema Statistics */}
          <div className="mt-6 pt-6 border-t">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Fields:</span>
                <span className="ml-2 font-medium">{schema.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Records:</span>
                <span className="ml-2 font-medium">{rawData?.length || 0}</span>
              </div>
              <div>
                <span className="text-gray-600">Last Updated:</span>
                <span className="ml-2 font-medium">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}