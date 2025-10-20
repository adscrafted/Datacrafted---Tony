# Component Migration Checklist

## Overview

This checklist tracks the migration of 109 components from the monolithic store to domain-specific stores.

**Goal:** Migrate all components to use `@/lib/stores` instead of `@/lib/store`

**Priority:** High-traffic components first for maximum performance impact

---

## High Priority (Performance Critical)

These components are rendered frequently and will benefit most from selective subscriptions.

### Dashboard Components

- [ ] **app/dashboard/page.tsx**
  - Current: Uses monolithic `useDataStore`
  - Needed: Split into `useDataStore`, `useUIStore`, `useChartStore`
  - State: `fileName`, `rawData`, `analysis`, `isCustomizing`, `selectedChartId`
  - Estimated time: 30 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/index.tsx**
  - Current: Subscribes to entire store for chart data
  - Needed: Use `useDataStore` for data, `useChartStore` for customization
  - State: `rawData`, `analysis`, `chartCustomizations`
  - Estimated time: 20 minutes

- [ ] **components/dashboard/flexible-dashboard-layout.tsx**
  - Current: Manages layout and drag state
  - Needed: Use `useUIStore` for drag state, `useChartStore` for layout
  - State: `isDragging`, `currentLayout`, `chartCustomizations`
  - Estimated time: 25 minutes

- [ ] **components/dashboard/chart-customization-panel.tsx**
  - Current: Heavy store usage for customizations
  - Needed: Use `useChartStore` primarily
  - State: `chartCustomizations`, `updateChartCustomization`, `currentTheme`
  - Estimated time: 20 minutes

- [ ] **components/dashboard/chat/chat-interface.tsx**
  - Current: Uses monolithic store for chat state
  - Needed: Use `useChatStore` exclusively
  - State: `chatMessages`, `isChatOpen`, `isChatLoading`
  - Estimated time: 15 minutes

---

## Medium Priority

These components are used frequently but updates are less critical.

### Chart Components

- [ ] **components/dashboard/chart-wrapper.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 15 minutes

- [ ] **components/dashboard/minimal-chart-wrapper.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 15 minutes

- [ ] **components/dashboard/chart-settings-panel-v3.tsx**
  - Needed: `useChartStore`, `useUIStore`
  - Estimated time: 20 minutes

- [ ] **components/dashboard/chart-settings-panel-v2.tsx**
  - Needed: `useChartStore`, `useUIStore`
  - Estimated time: 20 minutes

- [ ] **components/dashboard/chart-settings-panel.tsx**
  - Needed: `useChartStore`, `useUIStore`
  - Estimated time: 20 minutes

### Chart Renderers

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/ScorecardRenderer.tsx**
  - Needed: `useDataStore` for data, `useChartStore` for customization
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/GaugeRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/PieRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/LineRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/BarRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/TableRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/ScatterRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/ComboRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/WaterfallRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/FunnelRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/HeatmapRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/CohortRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/BulletRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/TreemapRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/SparklineRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/enhanced-chart-wrapper/renderers/SankeyRenderer.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

### Dashboard UI Components

- [ ] **components/dashboard/date-range-selector.tsx**
  - Needed: `useChartStore` for date range, `useUIStore` for selected column
  - Estimated time: 15 minutes

- [ ] **components/dashboard/theme-customization-panel.tsx**
  - Needed: `useChartStore` for themes
  - Estimated time: 15 minutes

- [ ] **components/dashboard/theme-provider.tsx**
  - Needed: `useChartStore` for current theme
  - Estimated time: 10 minutes

- [ ] **components/dashboard/dashboard-toolbar.tsx**
  - Needed: `useUIStore`, `useChartStore`
  - Estimated time: 15 minutes

- [ ] **components/dashboard/customization-panel.tsx**
  - Needed: `useUIStore`, `useChartStore`
  - Estimated time: 15 minutes

- [ ] **components/dashboard/export-share-panel.tsx**
  - Needed: `useSessionStore`, `useChartStore`
  - Estimated time: 15 minutes

- [ ] **components/dashboard/share-dialog.tsx**
  - Needed: `useSessionStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/schema-viewer.tsx**
  - Needed: `useDataStore` for schema
  - Estimated time: 10 minutes

- [ ] **components/dashboard/editable-schema-viewer.tsx**
  - Needed: `useDataStore` for schema and corrections
  - Estimated time: 15 minutes

- [ ] **components/dashboard/fullscreen-data-table.tsx**
  - Needed: `useDataStore`, `useUIStore`
  - Estimated time: 10 minutes

- [ ] **components/dashboard/chart-template-gallery.tsx**
  - Needed: `useUIStore`, `useChartStore`
  - Estimated time: 15 minutes

- [ ] **components/dashboard/chart-suggestion-builder.tsx**
  - Needed: `useDataStore`, `useChartStore`
  - Estimated time: 15 minutes

### Session Components

- [ ] **components/session/session-manager.tsx**
  - Needed: `useSessionStore` primarily
  - Estimated time: 15 minutes

- [ ] **components/session/save-dashboard.tsx**
  - Needed: `useSessionStore`
  - Estimated time: 10 minutes

- [ ] **components/session/auto-save-indicator.tsx**
  - Needed: `useSessionStore` for save state
  - Estimated time: 10 minutes

### Upload Components

- [ ] **components/upload/file-upload-core.tsx**
  - Needed: `useDataStore`, `useUIStore` for upload progress
  - Estimated time: 15 minutes

- [ ] **components/ui/upload-status-bar.tsx**
  - Needed: `useUIStore` for upload state
  - Estimated time: 10 minutes

---

## Low Priority

These components are used less frequently or in background processes.

### Utility Files

- [ ] **lib/services/ai-analysis.ts**
  - Needed: Import stores directly (not hooks)
  - Estimated time: 20 minutes

- [ ] **lib/services/chat-service.ts**
  - Needed: Import `useChatStore` directly
  - Estimated time: 15 minutes

- [ ] **lib/services/chart-suggestion-engine.ts**
  - Needed: Import stores directly
  - Estimated time: 15 minutes

- [ ] **lib/services/bigquery-service.ts**
  - Needed: Import `useDataStore` directly
  - Estimated time: 10 minutes

### Hooks

- [ ] **lib/hooks/use-data-store-selectors.ts**
  - Needed: Update to use new stores
  - Estimated time: 20 minutes

- [ ] **lib/hooks/use-data-store-optimized.ts**
  - Needed: Update to use new stores
  - Estimated time: 15 minutes

- [ ] **lib/hooks/use-chart-regeneration.ts**
  - Needed: Use `useDataStore`, `useChartStore`
  - Estimated time: 15 minutes

- [ ] **lib/hooks/use-chart-regeneration-with-tabs.ts**
  - Needed: Use `useDataStore`, `useChartStore`
  - Estimated time: 15 minutes

- [ ] **lib/hooks/use-chart-suggestions.ts**
  - Needed: Use `useDataStore`, `useChartStore`
  - Estimated time: 10 minutes

- [ ] **lib/hooks/use-auto-save.ts**
  - Needed: Use `useSessionStore`
  - Estimated time: 10 minutes

- [ ] **lib/hooks/use-progressive-data-loading.ts**
  - Needed: Use `useDataStore`
  - Estimated time: 10 minutes

### Utils

- [ ] **lib/utils/data-calculations.ts**
  - Needed: Import `useDataStore` directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/chart-validator.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/chart-hydrator.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/chart-data-processor.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/chart-rebalancer.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/chart-fallbacks.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/file-parser.ts**
  - Needed: Import `useDataStore` directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/file-parser-enhanced.ts**
  - Needed: Import `useDataStore` directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/file-parser-optimized.ts**
  - Needed: Import `useDataStore` directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/file-parser-multi-sheet.ts**
  - Needed: Import `useDataStore` directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/schema-analyzer.ts**
  - Needed: Import `useDataStore` directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/formula-parser.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/recommendation-scorer.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

- [ ] **lib/utils/data-aggregation.ts**
  - Needed: Import `useDataStore` directly (or use filtered-data utility)
  - Estimated time: 10 minutes

### API Routes

- [ ] **app/api/analyze/route.ts**
  - Needed: Import stores directly (server-side)
  - Estimated time: 15 minutes

- [ ] **app/api/chat/route.ts**
  - Needed: Import `useChatStore` directly
  - Estimated time: 10 minutes

- [ ] **app/api/recommendations/refresh/route.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

- [ ] **app/api/sessions/[id]/data/route.ts**
  - Needed: Import stores directly
  - Estimated time: 10 minutes

### Pages

- [ ] **app/page.tsx**
  - Needed: Use `useDataStore`, `useUIStore`
  - Estimated time: 15 minutes

- [ ] **app/projects/page.tsx**
  - Needed: Use appropriate stores
  - Estimated time: 15 minutes

---

## Migration Statistics

**Total Files:** 109
**High Priority:** 5 files (~2 hours)
**Medium Priority:** 40 files (~8 hours)
**Low Priority:** 64 files (~10 hours)

**Total Estimated Time:** ~20 hours
**Recommended Approach:** 4-5 hours per day over 4-5 days

---

## Migration Template

Use this template when migrating a component:

```typescript
// BEFORE
import { useDataStore } from '@/lib/store'

function MyComponent() {
  const {
    fileName,
    rawData,
    isCustomizing,
    chatMessages
  } = useDataStore()

  return <div>{fileName}</div>
}

// AFTER
import { useDataStore, useUIStore, useChatStore } from '@/lib/stores'
import { useShallow } from 'zustand/react/shallow'

function MyComponent() {
  // Data store - for fileName and rawData
  const { fileName, rawData } = useDataStore(
    useShallow((state) => ({
      fileName: state.fileName,
      rawData: state.rawData
    }))
  )

  // UI store - for isCustomizing
  const isCustomizing = useUIStore((state) => state.isCustomizing)

  // Chat store - for chatMessages
  const chatMessages = useChatStore((state) => state.chatMessages)

  return <div>{fileName}</div>
}
```

---

## Testing After Migration

For each migrated component, verify:

1. **Component still works** - No runtime errors
2. **State updates correctly** - Actions trigger expected changes
3. **Performance improved** - Fewer re-renders (use React DevTools)
4. **No memory leaks** - Subscriptions cleaned up properly

---

## Progress Tracking

Update this section as you complete migrations:

**Completed:** 0 / 109
**In Progress:** 0
**Remaining:** 109

**Last Updated:** [Date]

---

## Notes

- Start with high-priority components for maximum impact
- Test thoroughly after each batch (5-10 files)
- Use git commits to track progress
- Document any issues in separate file
- Update this checklist as you go

---

## Quick Commands

### Find all files using old store:
```bash
grep -r "from '@/lib/store'" --include="*.ts" --include="*.tsx" ./
```

### Find files not yet migrated:
```bash
grep -r "from '@/lib/store'" --include="*.ts" --include="*.tsx" ./ | grep -v "node_modules"
```

### Count remaining files:
```bash
grep -r "from '@/lib/store'" --include="*.ts" --include="*.tsx" ./ | grep -v "node_modules" | wc -l
```
