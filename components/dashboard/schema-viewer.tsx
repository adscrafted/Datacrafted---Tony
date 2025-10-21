'use client'

import React, { useState, useEffect } from 'react'
import { Table, Database, FileText, X, Info, Hash, Calendar, ToggleLeft, Type, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/stores/data-store'
import type { DataRow } from '@/lib/stores/data-store'

interface SchemaViewerProps {
  className?: string
}

interface ColumnSchema {
  name: string
  type: 'number' | 'string' | 'boolean' | 'date' | 'unknown'
  format?: string
  description?: string
  sampleValues: any[]
  uniqueCount: number
  nullCount: number
  nullPercentage: number
  stats?: {
    min?: number
    max?: number
    avg?: number
  }
}

const typeIcons = {
  number: Hash,
  string: Type,
  boolean: ToggleLeft,
  date: Calendar,
  unknown: FileCode
}

const typeColors = {
  number: 'text-blue-600 bg-blue-50',
  string: 'text-green-600 bg-green-50',
  boolean: 'text-purple-600 bg-purple-50',
  date: 'text-orange-600 bg-orange-50',
  unknown: 'text-gray-600 bg-gray-50'
}

export function SchemaViewer({ className }: SchemaViewerProps) {
  // Modular store migration - selective subscriptions
  const rawData = useDataStore((state) => state.rawData)
  const analysis = useDataStore((state) => state.analysis)
  const fileName = useDataStore((state) => state.fileName)

  const [isOpen, setIsOpen] = useState(false)
  const [schema, setSchema] = useState<ColumnSchema[]>([])

  useEffect(() => {
    if (rawData && rawData.length > 0) {
      generateSchema(rawData)
    }
  }, [rawData])

  const generateSchema = (data: DataRow[]) => {
    const columns = Object.keys(data[0] || {})
    
    const columnSchemas: ColumnSchema[] = columns.map(col => {
      const values = data.map(row => row[col])
      const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '')
      const uniqueValues = new Set(nonNullValues)
      const nullCount = values.length - nonNullValues.length
      
      // Determine column type
      let type: ColumnSchema['type'] = 'unknown'
      let format = ''
      
      if (nonNullValues.length > 0) {
        // Check for number
        if (nonNullValues.every(v => typeof v === 'number' && !isNaN(v))) {
          type = 'number'
          format = nonNullValues.some(v => typeof v === 'number' && v % 1 !== 0) ? 'decimal' : 'integer'
        }
        // Check for date
        else if (nonNullValues.every(v => {
          const parsed = Date.parse(String(v))
          return !isNaN(parsed) && String(v).match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}/)
        })) {
          type = 'date'
          const sample = String(nonNullValues[0])
          if (sample.includes('-')) format = 'YYYY-MM-DD'
          else if (sample.match(/\d{2}\/\d{2}\/\d{4}/)) format = 'MM/DD/YYYY'
          else if (sample.match(/\d{4}\/\d{2}\/\d{2}/)) format = 'YYYY/MM/DD'
        }
        // Check for boolean
        else if (nonNullValues.every(v => 
          typeof v === 'boolean' || 
          ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n'].includes(String(v).toLowerCase())
        )) {
          type = 'boolean'
          format = 'true/false'
        }
        // Default to string
        else {
          type = 'string'
          if (uniqueValues.size < 10) format = 'categorical'
          else if (nonNullValues.some(v => String(v).includes('@'))) format = 'email'
          else if (nonNullValues.some(v => String(v).match(/^https?:\/\//))) format = 'url'
          else format = 'text'
        }
      }
      
      // Calculate statistics for numeric columns
      let stats: ColumnSchema['stats'] = undefined
      if (type === 'number') {
        const numericValues = nonNullValues.map(v => Number(v))
        stats = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a, b) => a + b, 0) / numericValues.length
        }
      }
      
      // Get sample values
      const sampleValues = Array.from(uniqueValues).slice(0, 5)
      
      // Try to infer description from column name
      const description = inferDescription(col, type, format)
      
      return {
        name: col,
        type,
        format,
        description,
        sampleValues,
        uniqueCount: uniqueValues.size,
        nullCount,
        nullPercentage: (nullCount / values.length) * 100,
        stats
      }
    })
    
    setSchema(columnSchemas)
  }

  const inferDescription = (columnName: string, type: string, format: string): string => {
    const name = columnName.toLowerCase()
    
    // Marketing/Advertising specific patterns
    if (name.includes('impression')) return 'Number of times an ad was displayed to users'
    if (name.includes('click') && !name.includes('rate')) return 'Number of user clicks on the ad'
    if (name.includes('ctr') || name.includes('click') && name.includes('rate')) return 'Click-through rate (clicks/impressions)'
    if (name.includes('conversion')) return 'Number of desired actions taken (purchases, signups, etc.)'
    if (name.includes('cost') || name.includes('spend')) return 'Amount spent on advertising'
    if (name.includes('cpc')) return 'Cost per click - average cost for each click'
    if (name.includes('cpm')) return 'Cost per thousand impressions'
    if (name.includes('roas')) return 'Return on ad spend - revenue generated per dollar spent'
    if (name.includes('campaign')) return 'Marketing campaign identifier or name'
    if (name.includes('ad') && name.includes('group')) return 'Ad group within a campaign'
    if (name.includes('keyword')) return 'Search keyword or targeting keyword'
    if (name.includes('match') && name.includes('type')) return 'Keyword match type (exact, broad, phrase)'
    if (name.includes('bid')) return 'Bid amount for advertising placement'
    if (name.includes('budget')) return 'Allocated budget amount'
    if (name.includes('revenue') || name.includes('sales')) return 'Revenue generated from conversions'
    if (name.includes('order') && name.includes('total')) return 'Total value of orders'
    if (name.includes('acos')) return 'Advertising cost of sales (spend/revenue)'
    if (name.includes('product') || name.includes('sku')) return 'Product identifier or SKU'
    if (name.includes('asin')) return 'Amazon Standard Identification Number'
    if (name.includes('placement')) return 'Ad placement location'
    if (name.includes('device')) return 'Device type (mobile, desktop, tablet)'
    if (name.includes('start') && name.includes('date')) return 'Campaign or period start date'
    if (name.includes('end') && name.includes('date')) return 'Campaign or period end date'
    
    // E-commerce patterns
    if (name.includes('cart')) return 'Shopping cart related metric'
    if (name.includes('checkout')) return 'Checkout process metric'
    if (name.includes('abandon')) return 'Cart/checkout abandonment metric'
    
    // Common patterns
    if (name.includes('id')) return 'Unique identifier'
    if (name.includes('name')) return 'Name or label'
    if (name.includes('date') || name.includes('time')) return 'Date/time information'
    if (name.includes('price') || name.includes('amount')) return 'Monetary value'
    if (name.includes('count') || name.includes('quantity')) return 'Quantity or count'
    if (name.includes('email')) return 'Email address'
    if (name.includes('phone')) return 'Phone number'
    if (name.includes('address')) return 'Physical address'
    if (name.includes('url') || name.includes('link')) return 'Web URL'
    if (name.includes('status')) return 'Current status'
    if (name.includes('category') || name.includes('type')) return 'Classification category'
    if (name.includes('description') || name.includes('comment')) return 'Descriptive text'
    if (name.includes('percent') || name.includes('rate')) return 'Percentage or rate'
    
    // Type-based defaults
    if (type === 'boolean') return 'Boolean flag'
    if (type === 'date') return 'Date value'
    if (type === 'number' && format === 'decimal') return 'Numeric value with decimals'
    if (type === 'number' && format === 'integer') return 'Whole number value'
    if (type === 'string' && format === 'categorical') return 'Categorical value'
    
    return 'Data field'
  }

  const exportSchema = () => {
    const schemaExport = {
      fileName: fileName || 'data',
      generatedAt: new Date().toISOString(),
      totalRows: rawData.length,
      totalColumns: schema.length,
      columns: schema.map(col => ({
        name: col.name,
        type: col.type,
        format: col.format,
        description: col.description,
        nullable: col.nullCount > 0,
        nullPercentage: col.nullPercentage,
        uniqueValues: col.uniqueCount,
        sampleValues: col.sampleValues,
        statistics: col.stats
      }))
    }
    
    const blob = new Blob([JSON.stringify(schemaExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schema-${fileName || 'data'}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!rawData || rawData.length === 0) {
    return null
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2"
      >
        <Table className="h-4 w-4" />
        <span>Schema</span>
      </Button>
      
      {isOpen && (
        <Card className="absolute top-10 right-0 z-50 w-[600px] max-h-[80vh] overflow-hidden shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span>Data Schema</span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={exportSchema}
                  className="h-8 px-2 text-xs"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {rawData.length.toLocaleString()} rows × {schema.length} columns
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="overflow-y-auto max-h-[calc(80vh-100px)]">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr className="text-xs text-left">
                    <th className="px-4 py-2 font-medium">Column</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Format</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium text-right">Unique</th>
                    <th className="px-4 py-2 font-medium text-right">Nulls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {schema.map((col, index) => {
                    const Icon = typeIcons[col.type]
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{col.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className={cn(
                            'inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs',
                            typeColors[col.type]
                          )}>
                            <Icon className="h-3 w-3" />
                            <span>{col.type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">{col.format}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-muted-foreground">{col.description}</div>
                          {col.stats && (
                            <div className="text-xs text-blue-600 mt-1">
                              Range: {col.stats.min?.toFixed(2)} - {col.stats.max?.toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs">{col.uniqueCount}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'text-xs',
                            col.nullPercentage > 10 ? 'text-red-600' : 'text-gray-600'
                          )}>
                            {col.nullPercentage.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Schema Summary */}
            <div className="border-t bg-gray-50 p-4">
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-muted-foreground">Numeric</div>
                  <div className="font-medium">{schema.filter(c => c.type === 'number').length} columns</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Text</div>
                  <div className="font-medium">{schema.filter(c => c.type === 'string').length} columns</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Date/Time</div>
                  <div className="font-medium">{schema.filter(c => c.type === 'date').length} columns</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Boolean</div>
                  <div className="font-medium">{schema.filter(c => c.type === 'boolean').length} columns</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}