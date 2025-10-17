# Chat Conversations Feature

## Overview
This feature adds persistent chat conversations to the dashboard, allowing users to save, organize, and paginate their AI chat messages.

## What Was Built

### 1. Backend Infrastructure

#### Database Schema (`prisma/schema.prisma`)
- **ChatConversation Model**: Stores conversation metadata
  - Name (auto-generated from first user message)
  - Message count and last message preview
  - Pin status for important conversations
  - Project and user associations

- **ChatConversationMessage Model**: Stores individual messages
  - User and assistant messages
  - Optional metadata (for chart suggestions, etc.)
  - Timestamps for ordering

#### API Endpoints

**`/api/chat/conversations` (GET, POST)**
- GET: List all conversations for a project
  - Returns up to 50 most recent conversations
  - Sorted by pinned status, then last message time
- POST: Create a new conversation
  - Requires projectId
  - Optional custom name (defaults to "New Chat")

**`/api/chat/conversations/[id]/messages` (GET, POST)**
- GET: Fetch paginated messages (15 per page)
  - Cursor-based pagination for efficiency
  - Returns oldest-first for UI display
- POST: Send a new message
  - Atomic transaction: creates message + updates conversation metadata
  - Auto-names conversation from first user message

### 2. Frontend State Management

#### Zustand Store Updates (`lib/store.ts`)

**New Interfaces:**
```typescript
interface ChatConversation {
  id: string
  name: string
  projectId: string
  messageCount: number
  lastMessageAt?: string
  lastMessagePreview?: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

interface MessagePagination {
  cursor: string | null
  hasMore: boolean
  isLoading: boolean
}
```

**New State Variables:**
- `conversations`: Array of all conversations for current project
- `currentConversationId`: Currently selected conversation
- `isLoadingConversations`: Loading state for conversation list
- `messagePagination`: Pagination state for messages

**New Actions:**
- `loadConversations(projectId)`: Fetch all conversations for a project
- `createConversation(projectId, name?)`: Create and auto-select new conversation
- `selectConversation(conversationId)`: Load first 15 messages of conversation
- `loadMoreMessages()`: Load next page (15 messages) of current conversation
- `sendMessage(content)`: Send message with optimistic UI updates
- Plus setter methods for direct state management

### 3. UI Components

#### ConversationList (`components/dashboard/chat/conversation-list.tsx`)
- Displays list of conversations for current project
- Shows conversation name, message preview, and timestamp
- Highlights currently selected conversation
- "New Chat" button to create conversations
- Automatically loads when project changes
- Uses date-fns for relative timestamps ("2 hours ago")

#### LoadMoreMessages (`components/dashboard/chat/load-more-messages.tsx`)
- Appears above messages when more are available
- Shows loading spinner while fetching
- Automatically hides when no more messages

#### ChatWithConversations (`components/dashboard/chat/chat-with-conversations.tsx`)
- Wrapper component that manages layout
- Side-by-side display: conversation list + chat interface
- Handles empty states and conversation selection

## How It Works

### Message Flow

1. **Auto-Creating First Conversation**
   - When user opens dashboard with a project, conversations are loaded
   - If no conversations exist, system automatically creates first one
   - First conversation is auto-selected
   - User can immediately start chatting without manual "New Chat" click

2. **Creating Additional Conversations**
   - User clicks "New Chat" button in conversation list
   - System creates conversation in database linked to current project
   - Auto-selects new conversation
   - Chat interface clears and ready for new messages

3. **Selecting an Existing Conversation**
   - User clicks conversation in list
   - System fetches first 15 messages from API
   - Messages populate chat interface
   - "Load More" button appears if more messages exist

4. **Sending Messages**
   - User types message and hits send
   - If no conversation selected, system auto-creates one (fallback)
   - User message immediately appears in UI (optimistic update)
   - System calls `/api/chat` for AI response with streaming
   - AI response streams in real-time to UI
   - After streaming completes:
     - User message saved to database via `/api/chat/conversations/[id]/messages`
     - AI response saved to database via same endpoint
     - Conversation metadata updated (message count, preview, timestamp)
   - Both messages persist across page reloads

5. **Loading Older Messages**
   - User clicks "Load older messages" button (top of chat)
   - Next 15 messages fetched using cursor pagination
   - Messages prepended to chat (maintaining chronological order)
   - Button hides when no more messages available

### Data Persistence

- **Messages**: Stored in `chat_conversation_messages` table
- **Conversations**: Stored in `chat_conversations` table
- **Current State**: Persisted to localStorage via Zustand persist middleware
  - Conversations list
  - Currently selected conversation ID
  - (Messages loaded on-demand from database)

### Integration with Existing Chat

The implementation fully integrates with the existing AI chat functionality:
- `/api/chat` endpoint handles AI streaming responses (unchanged)
- Conversation APIs handle message persistence to database
- Chat messages stored in `chatMessages` array (Zustand store) AND database
- When conversation selected, messages loaded from database into store
- **Auto-conversation creation**: First conversation automatically created when user opens chat
- **Auto-project linking**: Uses `useProjectStore` to link conversations to current project
- Chat interface now saves both user and AI messages to conversation database
- Messages persist across page reloads from database

## Usage

### For Users

1. **Starting a New Chat**
   - Open dashboard with a project
   - Conversation list appears in left sidebar
   - Click "New Chat" to start fresh conversation
   - Type messages and receive AI responses as normal

2. **Switching Between Conversations**
   - Click any conversation in the list
   - Previous messages load automatically
   - Continue conversation where you left off

3. **Viewing Older Messages**
   - Scroll to top of chat interface
   - Click "Load older messages" if available
   - Previous 15 messages load and prepend to chat

4. **Conversation Organization**
   - Conversations auto-named from first message
   - Sorted by most recent activity
   - Pinned conversations stay at top (future feature)
   - Message preview shows last interaction

### For Developers

**Key Files Modified:**
- `/prisma/schema.prisma` - Database models
- `/lib/store.ts` - Zustand store with conversation state and defensive array checks
- `/app/api/chat/conversations/route.ts` - Conversation endpoints
- `/app/api/chat/conversations/[id]/messages/route.ts` - Message endpoints
- `/components/dashboard/chat/conversation-list.tsx` - Conversation UI with auto-creation
- `/components/dashboard/chat/load-more-messages.tsx` - Pagination UI
- `/components/dashboard/chat/chat-with-conversations.tsx` - Layout component
- `/components/dashboard/chat/resizable-chat-interface.tsx` - Updated to use new layout
- `/components/dashboard/chat/chat-interface.tsx` - **CRITICAL**: Updated to save messages to conversation DB
- `/lib/stores/project-store.ts` - Used for current project context

**To Extend:**

Add conversation actions (rename, delete, pin):
```typescript
// In store.ts
updateConversation: async (conversationId: string, updates: Partial<ChatConversation>) => {
  const response = await fetch(`/api/chat/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  })
  // Update local state...
}
```

Add conversation search/filter:
```typescript
// In conversation-list.tsx
const [searchQuery, setSearchQuery] = useState('')
const filteredConversations = conversations.filter(conv =>
  conv.name.toLowerCase().includes(searchQuery.toLowerCase())
)
```

## Benefits

1. **Message Persistence**: Chat history saved across page reloads
2. **Organization**: Multiple conversations per project
3. **Performance**: Pagination prevents loading thousands of messages
4. **User Experience**:
   - Quick access to past conversations
   - Clear separation between different chat topics
   - Smooth optimistic UI updates
5. **Scalability**: Cursor-based pagination handles large message histories

## Technical Decisions

1. **Cursor vs Offset Pagination**: Chose cursor-based for better performance with large datasets
2. **Message Ordering**: API returns newest-first (efficient), then reversed for UI display
3. **Optimistic Updates**: Messages appear instantly, then replaced with server response
4. **Transaction Safety**: Message creation and conversation updates happen atomically
5. **Auto-naming**: First user message (up to 50 chars) becomes conversation name
6. **Page Size**: 15 messages per page balances performance and UX

## Critical Fixes Applied

### 1. "Conversations is not iterable" Error
**Problem:** Zustand persist middleware could restore `conversations` as `undefined`, `null`, or non-array during hydration, causing crashes.

**Solution:** Multi-layer defensive programming:
- Line-level checks: `Array.isArray(state.conversations) ? state.conversations : []`
- Persist configuration validates conversations is array before saving
- Hydration callback validates and resets to `[]` if not array
- Component-level safety checks in `conversation-list.tsx`

### 2. Messages Not Saving to Database
**Problem:** `chat-interface.tsx` was calling `/api/chat` directly without saving to conversation database. Messages only existed in local state and were lost on page reload.

**Solution:** Updated `handleSendMessage` in `chat-interface.tsx`:
- Auto-creates conversation if none selected
- Calls `/api/chat` for AI response (streams as before)
- After streaming completes, saves BOTH user and AI messages to conversation DB
- Uses `/api/chat/conversations/[id]/messages` endpoint
- Messages now persist across sessions

### 3. Auto-Conversation Creation
**Problem:** Users had to manually click "New Chat" before they could start chatting, creating unnecessary friction.

**Solution:** Added auto-creation logic in `conversation-list.tsx`:
- After loading conversations, checks if array is empty
- If empty, automatically creates first conversation
- Auto-selects it so user can immediately start chatting
- Uses `useProjectStore` to link to current project

### 4. Project ID Integration
**Problem:** Conversation creation required a project ID but was using placeholder `'current-project'`.

**Solution:**
- Added `useProjectStore()` import to `chat-interface.tsx`
- Get `currentProjectId` from project store
- Use actual project ID for conversation creation
- Error handling if no project selected

## Future Enhancements

- **Conversation Actions**: Rename, delete, pin/unpin
- **Search and Filter**: Find conversations by content or date
- **Conversation Sharing**: Share specific conversations with team members
- **Export Options**: Download conversation transcripts
- **Keyboard Shortcuts**: Quick navigation between conversations
- **Infinite Scroll**: Alternative to "Load More" button
- **Conversation Tags**: Categorize conversations by topic
