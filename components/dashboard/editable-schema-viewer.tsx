'use client'

import React, { useState, useEffect } from 'react'
import { Edit2, Save, X, Database, Key, Type, Hash, Calendar, CheckCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/store'
import { cn } from '@/lib/utils/cn'

interface SchemaField {
  name: string
  type: string
  description?: string
  isPrimary?: boolean
  isRequired?: boolean
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

export function EditableSchemaViewer() {
  const { rawData, dataSchema } = useDataStore()
  const [schema, setSchema] = useState<SchemaField[]>([])
  const [editingField, setEditingField] = useState<EditingField | null>(null)
  const [isAddingField, setIsAddingField] = useState(false)
  const [newField, setNewField] = useState<SchemaField>({ name: '', type: 'string' })

  useEffect(() => {
    console.log('🔍 [SCHEMA_VIEWER] useEffect triggered:', {
      hasDataSchema: !!dataSchema,
      dataSchema,
      hasColumns: !!dataSchema?.columns,
      columnsLength: dataSchema?.columns?.length,
      timestamp: new Date().toISOString()
    })
    
    // Initialize schema from dataSchema
    if (dataSchema?.columns) {
      const fields: SchemaField[] = dataSchema.columns.map((col) => ({
        name: col.name,
        type: col.type,
        description: col.description || '',
        isPrimary: false,
        isRequired: col.nullPercentage === 0,
      }))
      console.log('✅ [SCHEMA_VIEWER] Setting schema fields:', fields)
      setSchema(fields)
    } else if (rawData && rawData.length > 0) {
      console.log('⚠️ [SCHEMA_VIEWER] No dataSchema found, generating from rawData')
      // Generate basic schema from rawData
      const columns = Object.keys(rawData[0] || {})
      const fields: SchemaField[] = columns.map((columnName) => ({
        name: columnName,
        type: 'string', // Default to string
        description: '',
        isPrimary: false,
        isRequired: false,
      }))
      console.log('✅ [SCHEMA_VIEWER] Generated schema from rawData:', fields)
      setSchema(fields)
    } else {
      console.log('⚠️ [SCHEMA_VIEWER] No dataSchema or rawData found, resetting schema')
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

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-base">
              <Database className="h-4 w-4" />
              <span>Data Schema</span>
            </CardTitle>
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
        </CardHeader>
        <CardContent>
          {/* Table View */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Field Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
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