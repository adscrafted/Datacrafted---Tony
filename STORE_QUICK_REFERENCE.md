# Store Quick Reference Guide

## Which Store Should I Use?

Use this quick lookup to find the right store for your needs:

### Data Store (`useDataStore`)
Use when working with:
- ✅ File name (`fileName`)
- ✅ Raw data (`rawData`, `dataId`)
- ✅ Data schema (`dataSchema`)
- ✅ Analysis results (`analysis`)
- ✅ Data corrections (`correctedSchema`)
- ✅ Analysis state (`isAnalyzing`, `analysisProgress`)

```typescript
import { useDataStore } from '@/lib/stores'

const fileName = useDataStore((state) => state.fileName)
const rawData = useDataStore((state) => state.rawData)
```

---

### UI Store (`useUIStore`)
Use when working with:
- ✅ Customization mode (`isCustomizing`)
- ✅ Selected chart (`selectedChartId`)
- ✅ Chart settings panel (`showChartSettings`)
- ✅ Drag state (`isDragging`, `draggedChartId`)
- ✅ Template gallery (`showChartTemplateGallery`)
- ✅ Context menu (`contextMenuPosition`)
- ✅ Upload progress (`uploadProgress`, `uploadStage`)

```typescript
import { useUIStore } from '@/lib/stores'

const isCustomizing = useUIStore((state) => state.isCustomizing)
const isDragging = useUIStore((state) => state.isDragging)
```

---

### Session Store (`useSessionStore`)
Use when working with:
- ✅ Current session (`currentSession`)
- ✅ Recent sessions (`recentSessions`)
- ✅ Session operations (create, load, save, export)
- ✅ Save state (`isSaving`, `saveError`)

```typescript
import { useSessionStore } from '@/lib/stores'

const currentSession = useSessionStore((state) => state.currentSession)
const createNewSession = useSessionStore((state) => state.createNewSession)
```

---

### Chart Store (`useChartStore`)
Use when working with:
- ✅ Chart customizations (`chartCustomizations`)
- ✅ Draft chart (`draftChart`)
- ✅ Current theme (`currentTheme`)
- ✅ Current layout (`currentLayout`)
- ✅ Dashboard filters (`dashboardFilters`)
- ✅ Date range (`dateRange`)
- ✅ Granularity (`granularity`)
- ✅ Undo/redo history

```typescript
import { useChartStore } from '@/lib/stores'

const currentTheme = useChartStore((state) => state.currentTheme)
const customization = useChartStore((state) => state.chartCustomizations[chartId])
```

---

### Chat Store (`useChatStore`)
Use when working with:
- ✅ Chat messages (`chatMessages`)
- ✅ Chat open state (`isChatOpen`)
- ✅ Chat loading (`isChatLoading`)
- ✅ Project chat operations

```typescript
import { useChatStore } from '@/lib/stores'

const chatMessages = useChatStore((state) => state.chatMessages)
const isChatOpen = useChatStore((state) => state.isChatOpen)
```

---

### Filtered Data Utility
Use when you need filtered/aggregated data:

```typescript
import { getFilteredData } from '@/lib/stores/filtered-data'

// Option 1: Direct function call
const filteredData = getFilteredData()

// Option 2: React hook (auto-subscribes)
import { useFilteredData } from '@/lib/stores/filtered-data'
const filteredData = useFilteredData()
```

---

## Common Patterns

### Pattern 1: Single Property

```typescript
// ✅ GOOD - Only re-renders when fileName changes
const fileName = useDataStore((state) => state.fileName)
```

### Pattern 2: Multiple Properties

```typescript
// ✅ GOOD - Use useShallow for multiple properties
import { useShallow } from 'zustand/react/shallow'

const { fileName, isAnalyzing } = useDataStore(
  useShallow((state) => ({
    fileName: state.fileName,
    isAnalyzing: state.isAnalyzing
  }))
)
```

### Pattern 3: Actions Only

```typescript
// ✅ GOOD - Get actions without subscribing to state
const setFileName = useDataStore((state) => state.setFileName)
```

### Pattern 4: Derived Data

```typescript
// ✅ GOOD - Use helper hooks
import { useHasChatMessages } from '@/lib/stores'

const hasMessages = useHasChatMessages()
```

---

## Anti-Patterns (Don't Do This!)

### ❌ BAD: Subscribe to Entire Store

```typescript
// ❌ BAD - Re-renders on ANY store change
const store = useDataStore()
```

### ❌ BAD: Multiple Separate Subscriptions

```typescript
// ❌ BAD - Creates multiple subscriptions
const fileName = useDataStore((state) => state.fileName)
const isAnalyzing = useDataStore((state) => state.isAnalyzing)

// ✅ GOOD - Use useShallow instead
const { fileName, isAnalyzing } = useDataStore(
  useShallow((state) => ({
    fileName: state.fileName,
    isAnalyzing: state.isAnalyzing
  }))
)
```

### ❌ BAD: Accessing Wrong Store

```typescript
// ❌ BAD - isChatOpen is in UI store, not data store
const isChatOpen = useDataStore((state) => state.isChatOpen)

// ✅ GOOD
const isChatOpen = useUIStore((state) => state.isChatOpen)
```

---

## Helper Hooks

Quick access to common patterns:

### UI Store Helpers

```typescript
import {
  useIsAnyChartSelected,
  useIsCustomizingMode,
  useDragState
} from '@/lib/stores'

const isAnyChartSelected = useIsAnyChartSelected()
const isCustomizing = useIsCustomizingMode()
const { isDragging, draggedChartId } = useDragState()
```

### Session Store Helpers

```typescript
import {
  useIsSavingSession,
  useCurrentSessionId,
  useHasActiveSession
} from '@/lib/stores'

const isSaving = useIsSavingSession()
const sessionId = useCurrentSessionId()
const hasSession = useHasActiveSession()
```

### Chart Store Helpers

```typescript
import {
  useChartCustomization,
  useVisibleChartIds,
  useCanUndo,
  useCanRedo
} from '@/lib/stores'

const customization = useChartCustomization(chartId)
const visibleChartIds = useVisibleChartIds()
const canUndo = useCanUndo()
const canRedo = useCanRedo()
```

### Chat Store Helpers

```typescript
import {
  useRecentMessages,
  useMessageCount,
  useHasChatMessages,
  useLastMessage
} from '@/lib/stores'

const recentMessages = useRecentMessages(10)
const messageCount = useMessageCount()
const hasMessages = useHasChatMessages()
const lastMessage = useLastMessage()
```

---

## Debugging Tips

### Check which store you're subscribed to:

```typescript
useEffect(() => {
  console.log('Component rendered')
}, []) // Logs every render
```

### Count re-renders:

```typescript
useEffect(() => {
  console.count('MyComponent render')
})
```

### Log state changes:

```typescript
const fileName = useDataStore((state) => {
  console.log('fileName changed:', state.fileName)
  return state.fileName
})
```

---

## Performance Checklist

Before committing your code, verify:

- [ ] Not subscribing to entire store (`const store = useStore()`)
- [ ] Using selective subscriptions for single properties
- [ ] Using `useShallow` for multiple properties
- [ ] Using correct store for your use case
- [ ] Not creating multiple subscriptions unnecessarily
- [ ] Using helper hooks when available

---

## Need Help?

1. Check **STORE_MIGRATION_GUIDE.md** for detailed examples
2. Review **STORE_REFACTORING_SUMMARY.md** for architecture overview
3. Look at store source code (heavily commented with examples)
4. Search for similar patterns in migrated components

---

## Import Reference

```typescript
// Core stores
import {
  useDataStore,
  useUIStore,
  useSessionStore,
  useChartStore,
  useChatStore
} from '@/lib/stores'

// Helper hooks
import {
  // UI helpers
  useIsAnyChartSelected,
  useIsCustomizingMode,
  useDragState,

  // Session helpers
  useIsSavingSession,
  useCurrentSessionId,
  useHasActiveSession,

  // Chart helpers
  useChartCustomization,
  useVisibleChartIds,
  useCanUndo,
  useCanRedo,

  // Chat helpers
  useRecentMessages,
  useMessageCount,
  useHasChatMessages,
  useLastMessage
} from '@/lib/stores'

// Utilities
import { getFilteredData, useFilteredData } from '@/lib/stores/filtered-data'
import { useShallow } from 'zustand/react/shallow'

// Types
import type {
  DataRow,
  ColumnSchema,
  DataSchema,
  AnalysisResult,
  SessionInfo,
  RecentSession,
  ChartCustomization,
  ChartTemplate,
  DashboardTheme,
  DashboardFilter,
  DashboardLayout,
  ChartType,
  ChatMessage
} from '@/lib/stores'
```
