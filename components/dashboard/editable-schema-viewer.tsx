'use client'

import React, { useState, useEffect } from 'react'
import { Edit2, Save, X, Database, Key, Type, Hash, Calendar, CheckCircle, FileText, Brain, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/store'
import { cn } from '@/lib/utils/cn'
import { auth, DEBUG_MODE } from '@/lib/config/firebase'

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
  const { rawData, dataSchema, setDataSchema, setAnalysis, setIsAnalyzing, setError } = useDataStore()
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [editingField, setEditingField] = useState<EditingField | null>(null)
  const [isAddingField, setIsAddingField] = useState(false)
  const [newField, setNewField] = useState<SchemaField>({ name: '', type: 'string' })
  const [isPushingToAI, setIsPushingToAI] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    // Initialize schema from dataSchema
    if (dataSchema?.columns) {
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
  }, [dataSchema, rawData])

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
    }
  }

  const handlePushToAI = async () => {
    if (!rawData || rawData.length === 0) {
      console.error('No data available to push to AI')
      return
    }

    setIsPushingToAI(true)
    // Set analyzing state to show the loading screen
    setIsAnalyzing(true)

    try {
      // Prepare the corrected schema information
      const correctedSchema = schema.map(field => ({
        name: field.name,
        type: field.type,
        description: field.description,
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
      if (!currentUser && !DEBUG_MODE) {
        console.warn('⚠️ [PUSH-TO-AI] No authenticated user for schema update')
        return
      }

      let authToken: string | undefined
      if (currentUser) {
        try {
          authToken = await currentUser.getIdToken()
          console.log('✅ [PUSH-TO-AI] Got Firebase auth token for API request')
        } catch (authError) {
          if (!DEBUG_MODE) {
            console.warn('⚠️ [PUSH-TO-AI] Failed to get auth token')
          }
          return
        }
      }

      // Build headers with optional auth token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      // Send sample data (same as initial upload) with corrected schema
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: rawData.slice(0, 100), // Send sample (first 100 rows) just like initial upload
          schema: dataSchema, // Send current schema
          correctedSchema: correctedSchema,
          feedback: 'User has corrected column types and descriptions. Please re-analyze with this updated schema information.',
          fileName: dataSchema?.fileName || 'data.csv'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to push to AI')
      }

      const result = await response.json()
      console.log('✅ [PUSH-TO-AI] Received AI analysis result:', {
        hasChartConfig: !!result.chartConfig,
        chartCount: result.chartConfig?.length || 0,
        hasInsights: !!result.insights
      })

      // Update the analysis result in store
      if (result) {
        setAnalysis(result)
        console.log('✅ [PUSH-TO-AI] Analysis updated in store')
      }

      // Update the dataSchema if AI provided additional insights
      if (result.schema) {
        setDataSchema({
          ...dataSchema,
          columns: result.schema.columns,
          businessContext: result.businessContext,
          relationships: result.relationships
        })
        console.log('✅ [PUSH-TO-AI] DataSchema updated with AI insights')
      }

      setHasUnsavedChanges(false)

      // Call the callback to switch back to Dashboard tab
      if (onAIUpdateComplete) {
        console.log('🔄 [PUSH-TO-AI] Calling onAIUpdateComplete callback to switch to Dashboard')
        onAIUpdateComplete()
      }
    } catch (error) {
      console.error('❌ [PUSH-TO-AI] Error pushing to AI:', error)
      setError(error instanceof Error ? error.message : 'Failed to push to AI')
    } finally {
      setIsPushingToAI(false)
      setIsAnalyzing(false)
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
      return <CheckCircle2 className="h-3 w-3 text-green-500" title={`${confidence}% confidence`} />
    } else if (confidence >= 60) {
      return <AlertCircle className="h-3 w-3 text-yellow-500" title={`${confidence}% confidence`} />
    } else {
      return <AlertCircle className="h-3 w-3 text-red-500" title={`${confidence}% confidence`} />
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