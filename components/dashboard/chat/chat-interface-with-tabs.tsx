'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, RotateCcw, Download, Loader2, Sparkles, BarChart3, ChevronDown, Zap, PanelLeftClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore } from '@/lib/stores/data-store'
import { useChatStore, type ChatMessage } from '@/lib/stores/chat-store'
import { useChartStore } from '@/lib/stores/chart-store'
import { ChatMessages } from './chat-messages'
import { ExampleQuestions } from './example-questions'
import { ChartSuggestions } from './chart-suggestions'
import { extractChartSuggestions, type ChartSuggestion } from '@/lib/services/chat-service'
import { useChartRegenerationWithTabs } from '@/lib/hooks/use-chart-regeneration-with-tabs'

interface ChatInterfaceWithTabsProps {
  activeTabId: string
  tabAnalyses: Record<string, any>
  setTabAnalyses: React.Dispatch<React.SetStateAction<Record<string, any>>>
}

export const ChatInterfaceWithTabs = React.memo(function ChatInterfaceWithTabs({
  activeTabId,
  tabAnalyses,
  setTabAnalyses
}: ChatInterfaceWithTabsProps) {
  // Data store - selective subscriptions
  const fileName = useDataStore((state) => state.fileName)
  const rawData = useDataStore((state) => state.rawData)
  const analysis = useDataStore((state) => state.analysis)

  // Chat store - selective subscriptions
  const chatMessages = useChatStore((state) => state.chatMessages)
  const isChatOpen = useChatStore((state) => state.isChatOpen)
  const isChatLoading = useChatStore((state) => state.isChatLoading)
  const chatError = useChatStore((state) => state.chatError)
  const setIsChatOpen = useChatStore((state) => state.setIsChatOpen)
  const setIsChatLoading = useChatStore((state) => state.setIsChatLoading)
  const setChatError = useChatStore((state) => state.setChatError)
  const addChatMessage = useChatStore((state) => state.addChatMessage)
  const clearChatHistory = useChatStore((state) => state.clearChatHistory)

  // Chart store - selective subscriptions
  const selectedChartId = useChartStore((state) => state.selectedChartId)
  const chartCustomizations = useChartStore((state) => state.chartCustomizations)

  const [message, setMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [streamingMessage, setStreamingMessage] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [chartSuggestions, setChartSuggestions] = useState<ChartSuggestion[]>([])
  const [selectedChartType, setSelectedChartType] = useState('auto')
  const [showChartSelector, setShowChartSelector] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { regenerateChartFromSuggestion } = useChartRegenerationWithTabs({
    activeTabId,
    tabAnalyses,
    setTabAnalyses
  })

  // Chart types available
  const chartTypes = [
    { id: 'auto', name: 'Auto Select', icon: '⚡' },
    { id: 'bar', name: 'Bar Chart', icon: '📊' },
    { id: 'line', name: 'Line Chart', icon: '📈' },
    { id: 'pie', name: 'Pie Chart', icon: '🥧' },
    { id: 'area', name: 'Area Chart', icon: '🏔️' },
    { id: 'scatter', name: 'Scatter Plot', icon: '📍' },
    { id: 'scorecard', name: 'Scorecard', icon: '🏆' },
    { id: 'table', name: 'Table', icon: '📋' },
    { id: 'pivot', name: 'Pivot Table', icon: '🗂️' },
    { id: 'gauge', name: 'Gauge', icon: '⏲️' }
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (chatMessages.length > 0) {
      scrollToBottom()
    }
  }, [chatMessages])

  useEffect(() => {
    if (isChatOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isChatOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowChartSelector(false)
      }
    }

    if (showChartSelector) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showChartSelector])

  const handleSendMessage = React.useCallback(async (messageToSend?: string) => {
    const actualMessage = messageToSend || message
    if (!actualMessage.trim() || isChatLoading || !rawData || rawData.length === 0) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: actualMessage.trim(),
      timestamp: new Date().toISOString()
    }

    addChatMessage(userMessage)
    setMessage('')
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setIsChatLoading(true)
    setChatError(null)
    setStreamingMessage('')

    try {
      // Prepare conversation history for context
      const conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // Get selected chart details if any
      let selectedChart: any = null
      if (selectedChartId && analysis) {
        selectedChart = analysis.chartConfig.find((c: any) =>
          (c.id || `chart-${analysis.chartConfig.indexOf(c)}`) === selectedChartId
        ) as any
      }

      // Try streaming first
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message: actualMessage.trim(),
          data: rawData,
          fileName,
          conversationHistory,
          preferredChartType: selectedChartType !== 'auto' ? selectedChartType : undefined,
          selectedChart: selectedChart ? {
            id: selectedChartId,
            title: selectedChart.title,
            type: selectedChart.type as any,  // Type assertion for compatibility with all chart types
            dataKey: selectedChart.dataKey,
            description: selectedChart.description
          } : null
        })
      })

      if (!response.ok) {
        throw new Error(response.status === 429
          ? 'Too many requests. Please wait a moment before trying again.'
          : 'Failed to get response from AI assistant'
        )
      }

      // Check if response is streaming
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/event-stream')) {
        // Handle streaming response
        setIsStreaming(true)
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        let accumulatedContent = ''

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break

              const chunk = decoder.decode(value)
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') {
                    // Streaming complete, add final message
                    const assistantMessage: ChatMessage = {
                      id: (Date.now() + 1).toString(),
                      role: 'assistant',
                      content: accumulatedContent,
                      timestamp: new Date().toISOString()
                    }
                    addChatMessage(assistantMessage)
                    setStreamingMessage('')
                    setIsStreaming(false)

                    // Extract chart suggestions from the final message
                    const suggestions = extractChartSuggestions(accumulatedContent)
                    setChartSuggestions(suggestions)
                    break
                  } else {
                    try {
                      const parsed = JSON.parse(data)
                      if (parsed.content) {
                        accumulatedContent += parsed.content
                        setStreamingMessage(accumulatedContent)
                      }
                    } catch (e) {
                      // Ignore JSON parse errors for chunks
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error('Streaming error:', error)
            setIsStreaming(false)
          } finally {
            reader.releaseLock()
          }
        }
      } else {
        // Handle non-streaming response
        const data = await response.json()

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: data.timestamp
        }

        addChatMessage(assistantMessage)

        // Extract and set chart suggestions
        const suggestions = extractChartSuggestions(data.message)
        setChartSuggestions(suggestions)
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatError(error instanceof Error ? error.message : 'Failed to get response')
    } finally {
      setIsChatLoading(false)
      setIsStreaming(false)
    }
  }, [message, isChatLoading, rawData, fileName, chatMessages, selectedChartId, analysis, selectedChartType, addChatMessage, setIsChatLoading, setChatError])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    // Auto-resize textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }

  const handleToggleSidebar = () => {
    // Dispatch event to toggle dashboard sidebar
    window.dispatchEvent(new Event('toggle-dashboard-sidebar'))
  }

  const handleApplyChartSuggestion = (suggestion: ChartSuggestion) => {
    const newChart = regenerateChartFromSuggestion(suggestion)
    if (newChart) {
      // Add a message about the chart being added
      const chartMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ Added "${suggestion.title}" to your dashboard${activeTabId !== 'dashboard-1' ? ' (current tab)' : ''}.`,
        timestamp: new Date().toISOString()
      }
      addChatMessage(chartMessage)

      // Clear suggestions after applying
      setChartSuggestions([])

      // Show success feedback
      const successToast = document.createElement('div')
      successToast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in'
      successToast.textContent = 'Chart added to dashboard!'
      document.body.appendChild(successToast)

      setTimeout(() => {
        successToast.remove()
      }, 3000)
    }
  }

  // Copy all the rest of the ChatInterface component code here...
  // (The render method and remaining logic stays the same, just replace regenerateChartFromSuggestion with the tab-aware version)

  if (!rawData || rawData.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3 max-w-md">
            <MessageCircle className="h-12 w-12 text-gray-300 mx-auto" />
            <p className="text-lg font-medium text-gray-600">No Data Available</p>
            <p className="text-sm text-gray-500">
              Upload a CSV file to start analyzing your data with AI assistance.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">AI Assistant</CardTitle>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChatHistory}
              disabled={chatMessages.length === 0}
              className="h-8 w-8 p-0"
              title="Clear chat"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleSidebar}
              className="h-8 w-8 p-0"
              title="Toggle sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {chatMessages.length === 0 && !streamingMessage ? (
            <div className="p-4 space-y-4">
              <ExampleQuestions
                onQuestionClick={(question) => {
                  // Send the question directly without relying on state
                  handleSendMessage(question)
                }}
                analysis={analysis}
              />
            </div>
          ) : (
            <ChatMessages
              messages={chatMessages}
              streamingMessage={streamingMessage}
              isStreaming={isStreaming}
            />
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat error */}
        {chatError && (
          <div className="px-3 py-2 bg-red-50 border-t border-red-200">
            <p className="text-sm text-red-600">{chatError}</p>
          </div>
        )}

        {/* Chart Suggestions */}
        {chartSuggestions.length > 0 && (
          <ChartSuggestions
            suggestions={chartSuggestions}
            onApplySuggestion={handleApplyChartSuggestion}
          />
        )}

        {/* Input Area */}
        <div className="border-t p-3 space-y-2 flex-shrink-0">
          {/* Chart Type Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowChartSelector(!showChartSelector)}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <span className="font-medium">Chart Type:</span>
              <span className="flex items-center space-x-1">
                <span>{chartTypes.find(t => t.id === selectedChartType)?.icon}</span>
                <span>{chartTypes.find(t => t.id === selectedChartType)?.name}</span>
              </span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showChartSelector ? 'rotate-180' : ''}`} />
            </button>

            {showChartSelector && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {chartTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setSelectedChartType(type.id)
                      setShowChartSelector(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center space-x-2 ${
                      selectedChartType === type.id ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    <span>{type.icon}</span>
                    <span>{type.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="flex items-end space-x-2">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask me about your data..."
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[40px] max-h-[120px]"
              rows={1}
              disabled={isChatLoading || isStreaming}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!message.trim() || isChatLoading || isStreaming}
              size="sm"
              className="h-10 px-3"
            >
              {isChatLoading || isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
