'use client'

import React from 'react'
import { User, Bot } from 'lucide-react'
import { ChatMessage } from '@/lib/store'
import { stripChartSuggestions } from '@/lib/services/chat-service'

interface ChatMessagesProps {
  messages: ChatMessage[]
  streamingMessage?: string
  isStreaming?: boolean
}

export function ChatMessages({ messages, streamingMessage, isStreaming }: ChatMessagesProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  const formatMessageContent = (content: string) => {
    // Simple formatting for better readability
    const lines = content.split('\n')
    return lines.map((line, index) => {
      // Handle bold text (markdown-style)
      const boldRegex = /\*\*(.*?)\*\*/g
      const formattedLine = line.replace(boldRegex, '<strong>$1</strong>')
      
      // Handle bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
        return (
          <li key={index} className="ml-4 list-disc break-words" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^[\-•]\s/, '') }} />
        )
      }

      // Handle numbered lists
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <li key={index} className="ml-4 list-decimal break-words" dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^\d+\.\s/, '') }} />
        )
      }

      // Regular paragraphs
      if (line.trim()) {
        return (
          <p key={index} className="mb-2 last:mb-0 break-words" dangerouslySetInnerHTML={{ __html: formattedLine }} />
        )
      }
      
      return <br key={index} />
    })
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start space-x-3 ${
            message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
          }`}
        >
          {/* Avatar */}
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === 'user' 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-blue-100 text-blue-600'
          }`}>
            {message.role === 'user' ? (
              <User className="h-4 w-4" />
            ) : (
              <Bot className="h-4 w-4" />
            )}
          </div>

          {/* Message Content */}
          <div className={`flex-1 max-w-[80%] min-w-0 ${message.role === 'user' ? 'text-right' : ''}`}>
            <div className={`rounded-lg p-3 ${
              message.role === 'user'
                ? 'bg-primary text-primary-foreground ml-auto'
                : 'bg-gray-100 text-gray-900'
            }`}>
              <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
                {message.role === 'user' ? (
                  <p className="break-words">{message.content}</p>
                ) : (
                  <div className="break-words">{formatMessageContent(stripChartSuggestions(message.content))}</div>
                )}
              </div>
            </div>
            
            {/* Timestamp */}
            <div className={`text-xs text-muted-foreground mt-1 ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}>
              {formatTimestamp(message.timestamp)}
            </div>
          </div>
        </div>
      ))}
      
      {/* Streaming Message */}
      {streamingMessage && (
        <div className="flex items-start space-x-3">
          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
            <Bot className="h-4 w-4" />
          </div>

          {/* Message Content */}
          <div className="flex-1 max-w-[80%] min-w-0">
            <div className="rounded-lg p-3 bg-gray-100 text-gray-900">
              <div className="text-sm leading-relaxed break-words overflow-wrap-anywhere">
                <div className="break-words">{formatMessageContent(stripChartSuggestions(streamingMessage))}</div>
                <div className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
              </div>
            </div>
            
            {/* Timestamp */}
            <div className="text-xs text-muted-foreground mt-1 text-left">
              Responding...
            </div>
          </div>
        </div>
      )}
    </div>
  )
}