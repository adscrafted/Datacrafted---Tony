'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, RotateCcw, Download, Loader2, Sparkles, BarChart3, ChevronDown, Zap, PanelLeftClose } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDataStore, ChatMessage } from '@/lib/store'
import { ChatMessages } from './chat-messages'
import { ExampleQuestions } from './example-questions'
import { ChartSuggestions } from './chart-suggestions'
import { extractChartSuggestions, ChartSuggestion, stripChartSuggestions } from '@/lib/services/chat-service'
import { useChartRegeneration } from '@/lib/hooks/use-chart-regeneration'
import { auth } from '@/lib/config/firebase'

export const ChatInterface = React.memo(function ChatInterface() {
  const {
    fileName,
    rawData,
    dataSchema,
    analysis,
    chatMessages,
    isChatOpen,
    isChatLoading,
    chatError,
    setIsChatOpen,
    setIsChatLoading,
    setChatError,
    addChatMessage,
    clearChatHistory,
    selectedChartId,
    chartCustomizations
  } = useDataStore()

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
  const { regenerateChartFromSuggestion } = useChartRegeneration()

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
    { id: 'gauge', name: 'Gauge', icon: '⏲️' },
    { id: 'funnel', name: 'Funnel', icon: '🔽' }
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

  const handleSendMessage = React.useCallback(async () => {
    if (!message.trim() || isChatLoading || !rawData || rawData.length === 0) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message.trim(),
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
      // Get Firebase auth token
      let authToken: string | undefined
      try {
        const currentUser = auth.currentUser
        if (currentUser) {
          authToken = await currentUser.getIdToken()
          console.log('✅ [CHAT] Got Firebase auth token')
        } else {
          console.warn('⚠️ [CHAT] No authenticated user - chat requires authentication')
          throw new Error('You must be signed in to use the AI Data Scientist')
        }
      } catch (authError) {
        console.error('❌ [CHAT] Failed to get auth token:', authError)
        throw new Error('Authentication failed. Please sign in and try again.')
      }

      // Prepare conversation history for context
      const conversationHistory = chatMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // Get selected chart details if any
      let selectedChart = null
      if (selectedChartId && analysis) {
        selectedChart = analysis.chartConfig.find(c =>
          (c.id || `chart-${analysis.chartConfig.indexOf(c)}`) === selectedChartId
        )
      }

      // Build headers with auth token
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      }

      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      // Try streaming first
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage.content,
          data: rawData,
          dataSchema,
          fileName,
          conversationHistory,
          preferredChartType: selectedChartType !== 'auto' ? selectedChartType : undefined,
          selectedChart: selectedChart ? {
            id: selectedChartId,
            title: selectedChart.title,
            type: selectedChart.type,
            dataKey: selectedChart.dataKey,
            description: selectedChart.description
          } : null
        })
      })

      if (!response.ok) {
        // Get detailed error from server
        let errorMessage = 'Failed to get response from AI assistant'
        try {
          const errorData = await response.json()
          console.error('❌ [CHAT] Server error response:', errorData)
          errorMessage = errorData.error || errorData.details || errorMessage
        } catch (e) {
          console.error('❌ [CHAT] Could not parse error response')
        }

        throw new Error(response.status === 429
          ? 'Too many requests. Please wait a moment before trying again.'
          : errorMessage
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
                        // Strip chart suggestions from the displayed streaming message
                        const strippedContent = stripChartSuggestions(accumulatedContent)
                        setStreamingMessage(strippedContent)
                      }
                    } catch (e) {
                      // Ignore parsing errors for individual chunks
                    }
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        }
      } else {
        // Handle non-streaming response (fallback)
        const data = await response.json()
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: data.timestamp
        }

        addChatMessage(assistantMessage)
        
        // Extract chart suggestions from the message
        const suggestions = extractChartSuggestions(data.message)
        setChartSuggestions(suggestions)
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatError(error instanceof Error ? error.message : 'Failed to send message')
      setStreamingMessage('')
      setIsStreaming(false)
    } finally {
      setIsChatLoading(false)
    }
  }, [message, isChatLoading, rawData, fileName, chatMessages, selectedChartType, selectedChartId, analysis, addChatMessage, setIsChatLoading, setChatError, setStreamingMessage, setIsStreaming, setChartSuggestions])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleExampleQuestion = (question: string) => {
    setMessage(question)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleApplyChartSuggestion = (suggestion: ChartSuggestion) => {
    const newChart = regenerateChartFromSuggestion(suggestion)
    if (newChart) {
      // Add a message about the chart being added
      const chartMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Great! I've added a ${suggestion.type} chart: "${suggestion.title}" to your dashboard. You can see it in the charts section below.`,
        timestamp: new Date().toISOString()
      }
      addChatMessage(chartMessage)
      
      // Clear suggestions after applying
      setChartSuggestions([])
      
      // Scroll to bottom to show the confirmation
      setTimeout(scrollToBottom, 100)
    }
  }

  const handleExportChat = () => {
    const chatContent = chatMessages.map(msg => 
      `${msg.role.toUpperCase()}: ${msg.content}\n`
    ).join('\n')
    
    const blob = new Blob([chatContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-conversation-${fileName || 'data'}-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const hasData = rawData && rawData.length > 0

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <Card className="h-full shadow-none border-0 rounded-none flex flex-col min-h-0 overflow-hidden">
        <CardHeader className="pb-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <CardTitle className="text-base flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>AI Data Scientist</span>
              </CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Try multiple methods to ensure it works
                if ((window as any).__toggleDashboardSidebar) {
                  (window as any).__toggleDashboardSidebar()
                } else {
                  // Fallback to event dispatch
                  window.dispatchEvent(new CustomEvent('toggle-dashboard-sidebar'))
                }
              }}
              className="h-8 w-8 p-0"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
          {fileName && (
            <p className="text-xs text-muted-foreground mt-2">
              Analyzing: {fileName}
            </p>
          )}
          {selectedChartId && analysis && (
            <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
              <p className="font-medium text-blue-800">
                Selected Chart: {
                  analysis.chartConfig.find(c => 
                    (c.id || `chart-${analysis.chartConfig.indexOf(c)}`) === selectedChartId
                  )?.title || 'Unknown'
                }
              </p>
              <p className="text-blue-600 mt-1">
                Ask questions about this specific chart
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
          {!hasData ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center space-y-2">
                <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Upload data to start chatting with your AI data scientist
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <ExampleQuestions
                    onQuestionClick={handleExampleQuestion}
                    analysis={analysis}
                  />
                ) : (
                  <ChatMessages messages={chatMessages} streamingMessage={streamingMessage} />
                )}
                
                {isChatLoading && !isStreaming && (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                )}
                
                {isStreaming && (
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <span className="text-sm">AI is responding...</span>
                  </div>
                )}
                
                {chatError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{chatError}</p>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Chart Suggestions */}
              {chartSuggestions.length > 0 && (
                <ChartSuggestions 
                  suggestions={chartSuggestions}
                  onApplySuggestion={handleApplyChartSuggestion}
                />
              )}

              {/* Input Area */}
              <div className="border-t p-3 space-y-2 flex-shrink-0">
                {chatMessages.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearChatHistory}
                      className="text-xs h-7"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportChat}
                      className="text-xs h-7"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                  </div>
                )}
                
                {/* Chart Type Selector */}
                <div className="mb-2">
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowChartSelector(!showChartSelector)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{chartTypes.find(t => t.id === selectedChartType)?.icon}</span>
                        <span>{chartTypes.find(t => t.id === selectedChartType)?.name}</span>
                      </div>
                      <ChevronDown className={`h-3 w-3 transition-transform ${showChartSelector ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showChartSelector && (
                      <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                        {chartTypes.map((type) => (
                          <button
                            key={type.id}
                            onClick={() => {
                              setSelectedChartType(type.id)
                              setShowChartSelector(false)
                            }}
                            className={`w-full flex items-center space-x-2 px-3 py-2 text-xs hover:bg-gray-50 ${
                              selectedChartType === type.id ? 'bg-blue-50 text-blue-700' : ''
                            }`}
                          >
                            <span className="text-sm">{type.icon}</span>
                            <span>{type.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value)
                      // Auto-resize textarea
                      if (inputRef.current) {
                        inputRef.current.style.height = 'auto'
                        inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
                      }
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Ask about your data..."
                    className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    style={{ minHeight: '80px', maxHeight: '200px' }}
                    rows={3}
                    disabled={isChatLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || isChatLoading}
                    className="absolute right-2 bottom-2 px-2 py-1 h-7"
                    size="sm"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-center text-gray-500">
                  Enter to send • Shift+Enter for new line
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
})