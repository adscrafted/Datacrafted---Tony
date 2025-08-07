import { useState, useCallback } from 'react'
import { ChartSuggestion } from '@/lib/types/chart-suggestion'
import { chartSuggestionEngine } from '@/lib/services/chart-suggestion-engine'
import { logger } from '@/lib/utils/logger'

/**
 * Hook for managing AI chart suggestions
 */
export function useChartSuggestions() {
  const [suggestions, setSuggestions] = useState<ChartSuggestion[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  /**
   * Process AI response and extract chart suggestions
   */
  const processAIResponse = useCallback(async (aiResponse: string) => {
    setIsProcessing(true)
    
    try {
      logger.debug('[ChartSuggestions] Processing AI response for chart suggestions')
      
      // Parse suggestions from AI response
      const newSuggestions = chartSuggestionEngine.parseAISuggestions(aiResponse)
      
      if (newSuggestions.length > 0) {
        setSuggestions(prev => [...prev, ...newSuggestions])
        logger.log(`[ChartSuggestions] Found ${newSuggestions.length} chart suggestions`)
      }
      
      return newSuggestions
    } catch (error) {
      logger.error('[ChartSuggestions] Failed to process AI response:', error)
      return []
    } finally {
      setIsProcessing(false)
    }
  }, [])

  /**
   * Add a manual suggestion
   */
  const addSuggestion = useCallback((suggestion: ChartSuggestion) => {
    setSuggestions(prev => [...prev, suggestion])
  }, [])

  /**
   * Remove a suggestion
   */
  const removeSuggestion = useCallback((suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId))
  }, [])

  /**
   * Clear all suggestions
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
  }, [])

  /**
   * Generate example suggestion for user's query
   */
  const generateExampleSuggestion = useCallback((userQuery: string): ChartSuggestion | null => {
    const query = userQuery.toLowerCase()
    
    // Detect patterns in user queries and suggest appropriate charts
    if (query.includes('top') && query.includes('campaign') && query.includes('spend')) {
      return {
        id: `suggestion-${Date.now()}`,
        type: 'table',
        title: 'Top Campaigns by Spend',
        description: 'Table showing highest spending campaigns',
        dataTransform: {
          orderBy: [{ column: 'spend', direction: 'desc' }],
          limit: 10,
          columns: [
            {
              name: 'spend',
              expression: 'CAST(REPLACE(REPLACE(spend, "$", ""), ",", "") AS FLOAT)',
              alias: 'spend_numeric'
            }
          ]
        },
        chartConfig: {},
        tableConfig: {
          columns: [
            { key: 'campaign_name', label: 'Campaign Name', type: 'text', sortable: true },
            { key: 'spend_numeric', label: 'Spend', type: 'currency', format: '$0,0.00', sortable: true },
            { key: 'impressions', label: 'Impressions', type: 'number', format: '0,0', sortable: true },
            { key: 'clicks', label: 'Clicks', type: 'number', format: '0,0', sortable: true }
          ],
          sortBy: 'spend_numeric',
          sortOrder: 'desc',
          pagination: true,
          pageSize: 10
        },
        confidence: 0.85,
        reasoning: 'User requested top campaigns by spend - table format is ideal for detailed comparisons',
        tags: ['spend', 'campaigns', 'ranking'],
        priority: 'high'
      }
    }
    
    if (query.includes('acos') && (query.includes('bad') || query.includes('high'))) {
      return {
        id: `suggestion-${Date.now()}`,
        type: 'table',
        title: 'Campaigns with High ACOS',
        description: 'Campaigns with poor ACOS performance that need optimization',
        dataTransform: {
          filter: [
            {
              column: 'acos',
              operator: 'greater_than',
              value: 0.5 // 50%
            }
          ],
          orderBy: [{ column: 'spend', direction: 'desc' }],
          limit: 10,
          columns: [
            {
              name: 'spend',
              expression: 'CAST(REPLACE(REPLACE(spend, "$", ""), ",", "") AS FLOAT)',
              alias: 'spend_numeric'
            },
            {
              name: 'acos',
              expression: 'CAST(REPLACE(acos, "%", "") AS FLOAT) / 100',
              alias: 'acos_numeric'
            }
          ]
        },
        chartConfig: {},
        tableConfig: {
          columns: [
            { key: 'campaign_name', label: 'Campaign Name', type: 'text', sortable: true },
            { key: 'spend_numeric', label: 'Spend', type: 'currency', format: '$0,0.00', sortable: true },
            { key: 'acos_numeric', label: 'ACOS', type: 'percentage', format: '0.0%', sortable: true },
            { key: 'impressions', label: 'Impressions', type: 'number', format: '0,0', sortable: true }
          ],
          sortBy: 'acos_numeric',
          sortOrder: 'desc',
          pagination: true,
          pageSize: 10
        },
        confidence: 0.9,
        reasoning: 'High ACOS indicates poor campaign performance and optimization opportunities',
        tags: ['acos', 'optimization', 'performance'],
        priority: 'high'
      }
    }

    return null
  }, [])

  return {
    suggestions,
    isProcessing,
    processAIResponse,
    addSuggestion,
    removeSuggestion,
    clearSuggestions,
    generateExampleSuggestion
  }
}