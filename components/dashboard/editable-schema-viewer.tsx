'use client'

import React, { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { Edit2, Save, X, Database, Key, Type, Hash, Calendar, CheckCircle, FileText, Brain, AlertCircle, CheckCircle2, Lightbulb, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDataStore } from '@/lib/stores/data-store'
import { cn } from '@/lib/utils/cn'
import { auth } from '@/lib/config/firebase'
import { toast } from '@/components/ui/toast'
import type { ColumnRole, SemanticType, CorrectedColumn } from '@/lib/types/recommendation'

interface SchemaField {
  name: string
  type: string
  description?: string
  isPrimary?: boolean
  isRequired?: boolean
  confidence?: number
  detectionReason?: string
  role: ColumnRole
  semanticType: SemanticType
  suggestedDescription?: string
  inferredFromName?: boolean
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

const columnRoles: { value: ColumnRole; label: string }[] = [
  { value: 'metric', label: 'Metric' },
  { value: 'dimension', label: 'Dimension' },
  { value: 'timestamp', label: 'Timestamp' },
  { value: 'identifier', label: 'Identifier' },
  { value: 'unknown', label: 'Unknown' },
]

const semanticTypes: { value: SemanticType; label: string }[] = [
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'count', label: 'Count' },
  { value: 'ratio', label: 'Ratio' },
  { value: 'id', label: 'ID' },
  { value: 'uuid', label: 'UUID' },
  { value: 'sku', label: 'SKU' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'phone', label: 'Phone' },
  { value: 'name', label: 'Name' },
  { value: 'label', label: 'Label' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'country', label: 'Country' },
  { value: 'zip', label: 'ZIP Code' },
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' },
  { value: 'score', label: 'Score' },
  { value: 'duration', label: 'Duration' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'DateTime' },
  { value: 'time', label: 'Time' },
  { value: 'generic', label: 'Generic' },
]

const getRoleBadgeColor = (role: ColumnRole): string => {
  switch (role) {
    case 'metric':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'dimension':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'timestamp':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'identifier':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

const getSemanticBadgeColor = (semanticType: SemanticType): string => {
  switch (semanticType) {
    case 'currency':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'percentage':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'count':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200'
    case 'id':
      return 'bg-slate-100 text-slate-800 border-slate-200'
    case 'email':
    case 'url':
    case 'phone':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    case 'category':
    case 'status':
      return 'bg-pink-100 text-pink-800 border-pink-200'
    case 'score':
    case 'ratio':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

// Helper to infer role from column name and type
const inferRole = (name: string, type: string): ColumnRole => {
  const lowerName = name.toLowerCase()

  // Timestamp patterns
  if (type === 'date' || lowerName.includes('date') || lowerName.includes('time') ||
      lowerName.includes('created') || lowerName.includes('updated') || lowerName.includes('timestamp')) {
    return 'timestamp'
  }

  // Identifier patterns
  if (lowerName.includes('id') || lowerName.includes('_id') || lowerName.includes('uuid') ||
      lowerName.includes('key') || lowerName === 'id') {
    return 'identifier'
  }

  // Metric patterns (numeric aggregatable values)
  if (type === 'number' && (
    lowerName.includes('amount') || lowerName.includes('total') || lowerName.includes('count') ||
    lowerName.includes('sum') || lowerName.includes('revenue') || lowerName.includes('cost') ||
    lowerName.includes('price') || lowerName.includes('quantity') || lowerName.includes('value') ||
    lowerName.includes('sales') || lowerName.includes('spend') || lowerName.includes('impressions') ||
    lowerName.includes('clicks') || lowerName.includes('conversions') || lowerName.includes('rate')
  )) {
    return 'metric'
  }

  // Dimension patterns (categorical/groupable values)
  if (type === 'string' && (
    lowerName.includes('name') || lowerName.includes('category') || lowerName.includes('type') ||
    lowerName.includes('status') || lowerName.includes('region') || lowerName.includes('country') ||
    lowerName.includes('channel') || lowerName.includes('source') || lowerName.includes('campaign')
  )) {
    return 'dimension'
  }

  return 'unknown'
}

// Helper to infer semantic type from column name and type
const inferSemanticType = (name: string, type: string): SemanticType => {
  const lowerName = name.toLowerCase()

  if (lowerName.includes('email')) return 'email'
  if (lowerName.includes('url') || lowerName.includes('link') || lowerName.includes('website')) return 'url'
  if (lowerName.includes('phone') || lowerName.includes('mobile') || lowerName.includes('tel')) return 'phone'
  if (lowerName.includes('address') || lowerName.includes('street') || lowerName.includes('city')) return 'address'

  if (type === 'number') {
    if (lowerName.includes('price') || lowerName.includes('cost') || lowerName.includes('revenue') ||
        lowerName.includes('amount') || lowerName.includes('spend') || lowerName.includes('budget')) {
      return 'currency'
    }
    if (lowerName.includes('rate') || lowerName.includes('percent') || lowerName.includes('ratio') ||
        lowerName.includes('ctr') || lowerName.includes('cvr')) {
      return 'percentage'
    }
    if (lowerName.includes('count') || lowerName.includes('quantity') || lowerName.includes('num') ||
        lowerName.includes('impressions') || lowerName.includes('clicks') || lowerName.includes('views')) {
      return 'count'
    }
    if (lowerName.includes('score') || lowerName.includes('rating')) return 'score'
    if (lowerName.includes('duration') || lowerName.includes('time') || lowerName.includes('seconds')) return 'duration'
  }

  if (lowerName.includes('id') || lowerName === 'id') return 'id'
  if (lowerName.includes('name')) return 'name'
  if (lowerName.includes('category') || lowerName.includes('type')) return 'category'
  if (lowerName.includes('status') || lowerName.includes('state')) return 'status'

  return 'generic'
}

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
  const [newField, setNewField] = useState<SchemaField>({
    name: '',
    type: 'string',
    role: 'unknown',
    semanticType: 'generic'
  })
  const [isPushingToAI, setIsPushingToAI] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    // First check if we have corrected schema stored from previous edits
    if (correctedSchema && correctedSchema.length > 0) {
      const fields: SchemaField[] = correctedSchema.map((col) => {
        const inferredRole = inferRole(col.name, col.type)
        const inferredSemanticType = inferSemanticType(col.name, col.type)
        return {
          name: col.name,
          type: col.type,
          description: col.description || '',
          isPrimary: false,
          isRequired: col.role === 'metric' || col.role === 'timestamp',
          confidence: undefined,
          detectionReason: undefined,
          role: col.role || inferredRole,
          semanticType: col.semanticType || inferredSemanticType,
          suggestedDescription: col.suggestedDescription,
          inferredFromName: !col.role || !col.semanticType,
        }
      })
      setSchema(fields)
    } else if (dataSchema?.columns) {
      // Initialize schema from dataSchema
      const fields: SchemaField[] = dataSchema.columns.map((col) => {
        const inferredRole = inferRole(col.name, col.type)
        const inferredSemanticType = inferSemanticType(col.name, col.type)
        return {
          name: col.name,
          type: col.type,
          description: col.description || '',
          isPrimary: false,
          isRequired: col.nullPercentage === 0 || inferredRole === 'metric' || inferredRole === 'timestamp',
          confidence: col.confidence,
          detectionReason: col.detectionReason,
          role: inferredRole,
          semanticType: inferredSemanticType,
          suggestedDescription: col.description ? undefined : generateSuggestedDescription(col.name, inferredRole, inferredSemanticType),
          inferredFromName: true,
        }
      })
      setSchema(fields)
    } else if (rawData && rawData.length > 0) {
      // Generate basic schema from rawData
      const columns = Object.keys(rawData[0] || {})
      const fields: SchemaField[] = columns.map((columnName) => {
        const type = 'string'
        const inferredRole = inferRole(columnName, type)
        const inferredSemanticType = inferSemanticType(columnName, type)
        return {
          name: columnName,
          type: type,
          description: '',
          isPrimary: false,
          isRequired: inferredRole === 'metric' || inferredRole === 'timestamp',
          role: inferredRole,
          semanticType: inferredSemanticType,
          suggestedDescription: generateSuggestedDescription(columnName, inferredRole, inferredSemanticType),
          inferredFromName: true,
        }
      })
      setSchema(fields)
    } else {
      setSchema([])
    }
  }, [dataSchema, rawData, correctedSchema])

  // Generate a suggested description based on column name, role, and semantic type
  const generateSuggestedDescription = (name: string, role: ColumnRole, semanticType: SemanticType): string => {
    const readableName = name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .toLowerCase()
      .trim()

    const roleDescriptions: Record<ColumnRole, string> = {
      metric: 'A numeric measure that can be aggregated',
      dimension: 'A categorical attribute for grouping data',
      timestamp: 'A date/time field for temporal analysis',
      identifier: 'A unique identifier for records',
      unknown: 'A data field',
    }

    const semanticDescriptions: Record<SemanticType, string> = {
      currency: 'representing monetary value',
      percentage: 'representing a rate or percentage',
      count: 'representing a quantity or count',
      ratio: 'representing a calculated ratio',
      id: 'uniquely identifying records',
      uuid: 'containing unique identifiers',
      sku: 'containing product identifiers',
      email: 'containing email addresses',
      url: 'containing web addresses',
      phone: 'containing phone numbers',
      name: 'containing names',
      label: 'containing text labels',
      address: 'containing location information',
      city: 'containing city names',
      country: 'containing country names',
      zip: 'containing postal codes',
      category: 'for categorization',
      status: 'indicating state or status',
      score: 'representing a score or rating',
      duration: 'representing time duration',
      date: 'containing date values',
      datetime: 'containing date and time values',
      time: 'containing time values',
      generic: '',
    }

    const roleDesc = roleDescriptions[role]
    const semanticDesc = semanticDescriptions[semanticType]

    if (semanticDesc) {
      return `${roleDesc} ${semanticDesc} (${readableName})`
    }
    return `${roleDesc} (${readableName})`
  }

  const handleEditField = (index: number) => {
    setEditingField({
      index,
      field: { ...schema[index] }
    })
  }

  const handleUseSuggestion = () => {
    if (editingField && editingField.field.suggestedDescription) {
      setEditingField({
        ...editingField,
        field: {
          ...editingField.field,
          description: editingField.field.suggestedDescription
        }
      })
    }
  }

  const handleSaveField = () => {
    if (editingField) {
      const updatedSchema = [...schema]
      // Mark as no longer inferred since user has edited it
      const updatedField = {
        ...editingField.field,
        inferredFromName: false,
      }
      updatedSchema[editingField.index] = updatedField
      setSchema(updatedSchema)
      setEditingField(null)
      setHasUnsavedChanges(true)

      // Also save to corrected schema store so edits persist
      const correctedFields: CorrectedColumn[] = updatedSchema.map(field => ({
        name: field.name,
        type: field.type,
        description: field.description || '',
        userCorrected: true,
        role: field.role,
        semanticType: field.semanticType,
        suggestedDescription: field.suggestedDescription,
      }))
      setCorrectedSchema(correctedFields)
    }
  }

  const handlePushToAI = async () => {
    if (!rawData || rawData.length === 0) {
      toast.error('No data available. Please upload a file first.')
      return
    }

    setIsPushingToAI(true)

    // Track timing for minimum loading duration
    const startTime = performance.now()
    const minimumLoadingDuration = 800 // ms - ensure user sees loading screen

    // CRITICAL: Use flushSync to force synchronous state updates
    // This ensures the dashboard sees the updated state immediately
    flushSync(() => {
      setAnalysis(null)
      setIsAnalyzing(true)
      setAnalysisProgress(0)
    })

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
    if (onAIUpdateComplete) {
      onAIUpdateComplete()
    }

    // Brief delay for view to switch
    await new Promise(resolve => setTimeout(resolve, 100))

    // Track API timing (needs to be outside try block for error handling)
    const apiStartTime = performance.now()

    try {
      // Prepare the corrected schema information with all new fields
      const correctedSchemaPayload: CorrectedColumn[] = schema.map(field => ({
        name: field.name,
        type: field.type,
        description: field.description || '',
        userCorrected: true,
        role: field.role,
        semanticType: field.semanticType,
        suggestedDescription: field.suggestedDescription,
      }))

      // Get Firebase auth token for API authentication
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('Authentication required. Please sign in to continue.')
      }

      let authToken: string | undefined
      try {
        authToken = await currentUser.getIdToken()
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
        correctedSchema: correctedSchemaPayload,
        feedback: 'User has corrected column types, roles, semantic types, and descriptions. Please re-analyze with this updated schema information.',
        fileName: dataSchema?.fileName || 'data.csv'
      }

      const bodyString = JSON.stringify(requestBody)

      // Create AbortController for timeout
      const abortController = new AbortController()
      const timeout = setTimeout(() => {
        abortController.abort()
      }, 270000) // 4.5 minute timeout (270 seconds)

      let response: Response
      try {
        response = await fetch('/api/analyze', {
          method: 'POST',
          headers,
          body: bodyString,
          signal: abortController.signal
        })
        clearTimeout(timeout)
      } catch (fetchError) {
        clearTimeout(timeout)
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('AI analysis timed out after 5 minutes. Please try again with a smaller dataset.')
        }
        throw new Error(`Network error: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle paywall (402) response - show upgrade modal
        if (response.status === 402 && errorData.type === 'paywall') {
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

      // Clear progress simulation and set to 100%
      clearInterval(progressInterval)
      setAnalysisProgress(100)

      // Update the analysis result in store
      if (result) {
        setAnalysis(result)
      }

      // CRITICAL: Persist correctedSchema to data-store so it can be used for future operations
      setCorrectedSchema(correctedSchemaPayload)

      // SMART INVALIDATION: Only clear charts that use changed columns
      // This preserves user customizations for charts that don't depend on the modified schema fields
      const { useChartStore } = await import('@/lib/stores/chart-store')
      const chartStore = useChartStore.getState()

      // Determine which columns actually changed by comparing current schema edits
      // against the previously corrected schema (if any) or original dataSchema
      const getChangedColumns = (): string[] => {
        const changed: string[] = []

        // Compare against correctedSchema if we have previous edits, otherwise use dataSchema
        const previousSchema = correctedSchema && correctedSchema.length > 0
          ? correctedSchema
          : (dataSchema?.columns || []).map(c => ({
              name: c.name,
              type: c.type,
              role: inferRole(c.name, c.type),
              semanticType: inferSemanticType(c.name, c.type)
            }))

        // Track current column names for detecting deleted columns
        const currentColumnNames = new Set(schema.map(f => f.name.toLowerCase()))

        // Check for new or modified columns
        schema.forEach(field => {
          const originalCol = previousSchema.find(
            c => c.name.toLowerCase() === field.name.toLowerCase()
          )

          // Column is new or type/role/semanticType changed
          if (!originalCol ||
              originalCol.type !== field.type ||
              originalCol.role !== field.role ||
              originalCol.semanticType !== field.semanticType) {
            changed.push(field.name)
          }
        })

        // Check for deleted/renamed columns (columns in previous but not in current)
        // This ensures charts using deleted columns are also invalidated
        previousSchema.forEach(prevCol => {
          if (!currentColumnNames.has(prevCol.name.toLowerCase())) {
            changed.push(prevCol.name)
          }
        })

        return [...new Set(changed)] // dedupe in case of overlaps
      }

      const changedColumns = getChangedColumns()

      // Smart invalidation - only clear charts using changed columns
      if (changedColumns.length > 0) {
        chartStore.invalidateChartsUsingColumns(changedColumns)
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
      }

      setHasUnsavedChanges(false)

      // Ensure minimum loading duration AFTER successful API call
      const elapsedTime = performance.now() - startTime
      const remainingTime = Math.max(0, minimumLoadingDuration - elapsedTime)
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }

      // Cleanup after successful completion
      setIsPushingToAI(false)
      setIsAnalyzing(false)
      toast.success('Schema updated and new charts generated!')

    } catch (error) {
      // Clear progress simulation on error
      clearInterval(progressInterval)

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
      toast.error(errorMessage, { duration: 5000 })

      // Ensure minimum loading duration AFTER error
      const elapsedTime = performance.now() - startTime
      const remainingTime = Math.max(0, minimumLoadingDuration - elapsedTime)
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime))
      }

      // Cleanup after error
      setIsPushingToAI(false)
      setIsAnalyzing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingField(null)
  }

  const handleAddField = () => {
    if (newField.name.trim()) {
      const role = inferRole(newField.name, newField.type)
      const semanticType = inferSemanticType(newField.name, newField.type)
      setSchema([...schema, {
        ...newField,
        role,
        semanticType,
        suggestedDescription: generateSuggestedDescription(newField.name, role, semanticType),
        inferredFromName: true,
      }])
      setNewField({ name: '', type: 'string', role: 'unknown', semanticType: 'generic' })
      setIsAddingField(false)
      setHasUnsavedChanges(true)
    }
  }

  const handleDeleteField = (index: number) => {
    setSchema(schema.filter((_, i) => i !== index))
    setHasUnsavedChanges(true)
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

  // Check if a field needs a description warning
  const needsDescriptionWarning = (field: SchemaField): boolean => {
    return (field.role === 'metric' || field.role === 'timestamp') && !field.description
  }

  return (
    <TooltipProvider>
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
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-700">Semantic</th>
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
                            <Select
                              value={editingField.field.role}
                              onValueChange={(value: ColumnRole) => setEditingField({
                                ...editingField,
                                field: { ...editingField.field, role: value }
                              })}
                            >
                              <SelectTrigger className="w-full text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {columnRoles.map(role => (
                                  <SelectItem key={role.value} value={role.value}>
                                    <span className="text-sm">{role.label}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <Select
                              value={editingField.field.semanticType}
                              onValueChange={(value: SemanticType) => setEditingField({
                                ...editingField,
                                field: { ...editingField.field, semanticType: value }
                              })}
                            >
                              <SelectTrigger className="w-full text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {semanticTypes.map(st => (
                                  <SelectItem key={st.value} value={st.value}>
                                    <span className="text-sm">{st.label}</span>
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
                            <div className="space-y-1">
                              <Input
                                value={editingField.field.description || ''}
                                onChange={(e) => setEditingField({
                                  ...editingField,
                                  field: { ...editingField.field, description: e.target.value }
                                })}
                                className="w-full text-sm"
                                placeholder={editingField.field.suggestedDescription || "Description (optional)"}
                              />
                              {editingField.field.suggestedDescription && !editingField.field.description && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleUseSuggestion}
                                    className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                  >
                                    <Lightbulb className="h-3 w-3 mr-1" />
                                    Use suggestion
                                  </Button>
                                </div>
                              )}
                            </div>
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
                              {field.inferredFromName && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Sparkles className="h-3 w-3 text-purple-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Role and type inferred from column name</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center space-x-1">
                              {getTypeIcon(field.type)}
                              <span className="text-sm text-gray-600">{field.type}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <Badge
                              variant="outline"
                              className={cn("text-xs", getRoleBadgeColor(field.role))}
                            >
                              {field.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-2">
                            <Badge
                              variant="outline"
                              className={cn("text-xs", getSemanticBadgeColor(field.semanticType))}
                            >
                              {field.semanticType}
                            </Badge>
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
                            <div className="flex items-center space-x-1">
                              {needsDescriptionWarning(field) && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertCircle className="h-3 w-3 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Key column - consider adding a description for better analysis</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              <span className="text-sm text-gray-600">{field.description || '-'}</span>
                            </div>
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
                        <Select
                          value={newField.role}
                          onValueChange={(value: ColumnRole) => setNewField({ ...newField, role: value })}
                        >
                          <SelectTrigger className="w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {columnRoles.map(role => (
                              <SelectItem key={role.value} value={role.value}>
                                <span className="text-sm">{role.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2">
                        <Select
                          value={newField.semanticType}
                          onValueChange={(value: SemanticType) => setNewField({ ...newField, semanticType: value })}
                        >
                          <SelectTrigger className="w-full text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {semanticTypes.map(st => (
                              <SelectItem key={st.value} value={st.value}>
                                <span className="text-sm">{st.label}</span>
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
                              setNewField({ name: '', type: 'string', role: 'unknown', semanticType: 'generic' })
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
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Fields:</span>
                  <span className="ml-2 font-medium">{schema.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Metrics:</span>
                  <span className="ml-2 font-medium">{schema.filter(f => f.role === 'metric').length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Dimensions:</span>
                  <span className="ml-2 font-medium">{schema.filter(f => f.role === 'dimension').length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Records:</span>
                  <span className="ml-2 font-medium">{rawData?.length || 0}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
