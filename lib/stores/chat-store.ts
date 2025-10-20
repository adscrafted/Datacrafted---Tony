/**
 * CHAT STORE - Chat interface and message management
 *
 * Purpose: Manages chat messages, chat UI state, and project-based chat persistence
 *
 * PERFORMANCE OPTIMIZATIONS:
 * - Only persists recent 50 messages (prevents localStorage bloat)
 * - Transient UI state (isChatOpen, isChatLoading) not persisted
 * - Project-based chat loaded on-demand from API
 *
 * USAGE EXAMPLES:
 *
 * // ✅ GOOD - Selective subscription to messages
 * const chatMessages = useChatStore((state) => state.chatMessages)
 *
 * // ✅ GOOD - Subscribe to loading state only
 * const isChatLoading = useChatStore((state) => state.isChatLoading)
 *
 * // ✅ GOOD - Multiple properties with shallow comparison
 * import { useShallow } from 'zustand/react/shallow'
 * const { isChatOpen, chatMessages } = useChatStore(
 *   useShallow((state) => ({ isChatOpen: state.isChatOpen, chatMessages: state.chatMessages }))
 * )
 *
 * // ❌ BAD - Subscribes to entire store
 * const store = useChatStore()
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

interface ChatStore {
  // Chat state
  chatMessages: ChatMessage[]
  isChatOpen: boolean
  isChatLoading: boolean
  chatError: string | null

  // Chat actions
  addChatMessage: (message: ChatMessage) => void
  setChatMessages: (messages: ChatMessage[]) => void
  setIsChatOpen: (isOpen: boolean) => void
  setIsChatLoading: (isLoading: boolean) => void
  setChatError: (error: string | null) => void
  clearChatHistory: () => void

  // Project-based chat persistence actions
  loadProjectChat: (projectId: string, authToken: string) => Promise<void>
  saveProjectChatMessage: (projectId: string, message: ChatMessage, authToken: string) => Promise<ChatMessage | null>
  clearProjectChat: (projectId: string, authToken: string) => Promise<void>
  replaceChatMessage: (tempId: string, realMessage: ChatMessage) => void

  // Session-based chat persistence (legacy support)
  saveChatMessage: (message: ChatMessage) => Promise<void>
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      chatMessages: [],
      isChatOpen: false,
      isChatLoading: false,
      chatError: null,

      // Basic chat actions
      addChatMessage: (message) => {
        console.log('💬 [CHAT_STORE] Adding message:', message.role)
        set((state) => ({
          chatMessages: [...state.chatMessages, message]
        }))
      },

      setChatMessages: (messages) => {
        console.log('💬 [CHAT_STORE] Setting messages:', messages.length)
        set({ chatMessages: messages })
      },

      setIsChatOpen: (isOpen) => {
        console.log('💬 [CHAT_STORE] Setting chat open:', isOpen)
        set({ isChatOpen: isOpen })
      },

      setIsChatLoading: (isLoading) => {
        set({ isChatLoading: isLoading })
      },

      setChatError: (error) => {
        if (error) {
          console.error('❌ [CHAT_STORE] Chat error:', error)
        }
        set({ chatError: error })
      },

      clearChatHistory: () => {
        console.log('🗑️ [CHAT_STORE] Clearing chat history')
        set({ chatMessages: [] })
      },

      // Project-based chat persistence
      loadProjectChat: async (projectId, authToken) => {
        console.log('📥 [CHAT_STORE] Loading project chat:', projectId)
        set({ isChatLoading: true, chatError: null })

        try {
          const response = await fetch(`/api/projects/${projectId}/chat`, {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          })

          if (!response.ok) {
            throw new Error('Failed to load chat messages')
          }

          const { messages } = await response.json()
          console.log('✅ [CHAT_STORE] Loaded messages:', messages?.length || 0)

          set({
            chatMessages: messages || [],
            isChatLoading: false
          })
        } catch (error) {
          console.error('❌ [CHAT_STORE] Failed to load project chat:', error)
          set({
            chatError: error instanceof Error ? error.message : 'Failed to load chat messages',
            isChatLoading: false
          })
        }
      },

      saveProjectChatMessage: async (projectId, message, authToken) => {
        console.log('💾 [CHAT_STORE] Saving project chat message:', projectId)

        try {
          const response = await fetch(`/api/projects/${projectId}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
              role: message.role,
              content: message.content
            }),
          })

          if (!response.ok) {
            throw new Error('Failed to save chat message')
          }

          const { message: savedMessage } = await response.json()
          console.log('✅ [CHAT_STORE] Message saved:', savedMessage.id)
          return savedMessage
        } catch (error) {
          console.error('❌ [CHAT_STORE] Failed to save project chat message:', error)
          set({
            chatError: error instanceof Error ? error.message : 'Failed to save chat message'
          })
          return null
        }
      },

      clearProjectChat: async (projectId, authToken) => {
        console.log('🗑️ [CHAT_STORE] Clearing project chat:', projectId)
        set({ isChatLoading: true, chatError: null })

        try {
          const response = await fetch(`/api/projects/${projectId}/chat`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          })

          if (!response.ok) {
            throw new Error('Failed to clear chat history')
          }

          console.log('✅ [CHAT_STORE] Project chat cleared')
          set({
            chatMessages: [],
            isChatLoading: false
          })
        } catch (error) {
          console.error('❌ [CHAT_STORE] Failed to clear project chat:', error)
          set({
            chatError: error instanceof Error ? error.message : 'Failed to clear chat history',
            isChatLoading: false
          })
        }
      },

      replaceChatMessage: (tempId, realMessage) => {
        console.log('🔄 [CHAT_STORE] Replacing message:', tempId)
        set((state) => ({
          chatMessages: state.chatMessages.map(msg =>
            msg.id === tempId ? realMessage : msg
          )
        }))
      },

      // Session-based chat persistence (legacy support)
      saveChatMessage: async (message) => {
        console.log('💾 [CHAT_STORE] Saving session chat message (legacy)')
        // Note: This would need to get currentSession from session-store
        // For now, it's a no-op placeholder
        try {
          // await fetch(`/api/sessions/${sessionId}/chat`, {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ role: message.role, content: message.content }),
          // })
        } catch (error) {
          console.error('❌ [CHAT_STORE] Failed to save chat message:', error)
        }
      },
    }),
    {
      name: 'datacrafted-chat-store',
      // OPTIMIZATION: Only persist recent 50 messages to prevent localStorage bloat
      partialize: (state) => ({
        chatMessages: state.chatMessages.slice(-50),
        // DO NOT persist transient UI state (isChatOpen, isChatLoading, chatError)
      }),
    }
  )
)

/**
 * Selector hooks for common chat patterns
 */

// Get recent messages (last N)
export const useRecentMessages = (count: number = 10) =>
  useChatStore((state) => state.chatMessages.slice(-count))

// Get message count
export const useMessageCount = () =>
  useChatStore((state) => state.chatMessages.length)

// Check if chat has messages
export const useHasChatMessages = () =>
  useChatStore((state) => state.chatMessages.length > 0)

// Get last message
export const useLastMessage = () =>
  useChatStore((state) => {
    const messages = state.chatMessages
    return messages.length > 0 ? messages[messages.length - 1] : null
  })
