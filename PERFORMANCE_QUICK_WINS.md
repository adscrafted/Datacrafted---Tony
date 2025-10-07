# Performance Quick Wins - Implementation Guide

**Estimated Time:** 2-3 hours
**Expected Impact:** 30-50% performance improvement

---

## 1. Selective Zustand Subscriptions (30 minutes)

### Current Problem
Components re-render unnecessarily when unrelated store state changes.

### Quick Fix

Replace this pattern throughout your components:

```tsx
// ❌ BEFORE - Re-renders on ANY store change
const Dashboard = () => {
  const { rawData, analysis, currentTheme } = useDataStore();
  return <div>...</div>;
};
```

With selective subscriptions:

```tsx
// ✅ AFTER - Only re-renders when specific values change
const Dashboard = () => {
  const insights = useDataStore(state => state.analysis?.insights);
  const chartColors = useDataStore(state => state.currentTheme.chartColors);
  // Component only re-renders when insights or chartColors change
  return <div>...</div>;
};
```

### Files to Update

1. `/components/dashboard/enhanced-chart-wrapper.tsx`
2. `/components/dashboard/flexible-dashboard-layout.tsx`
3. `/components/dashboard/chart-customization-panel.tsx`
4. `/app/dashboard/page.tsx`

### Example for Chart Wrapper

```tsx
// enhanced-chart-wrapper.tsx
export const EnhancedChartWrapper = ({ id, type, ...props }) => {
  // Instead of:
  // const { getFilteredData, chartCustomizations } = useDataStore();

  // Use:
  const customization = useDataStore(state => state.chartCustomizations[id]);
  const dateRange = useDataStore(state => state.dateRange);
  const filters = useDataStore(state => state.dashboardFilters);

  // Actions don't cause re-renders
  const updateCustomization = useDataStore(state => state.updateChartCustomization);

  // ... rest of component
};
```

---

## 2. Data Sampling for Large Datasets (45 minutes)

### Current Problem
Charts with >1000 data points render slowly and consume excessive memory.

### Quick Fix

Add data sampling to all chart components:

```tsx
import { processDataForChart } from '@/lib/utils/performance/data-sampling';

const LineChartOptimized = ({ data, xKey, yKey }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  // Automatically sample data based on container width
  const { processedData, wasSampled, originalCount } = useMemo(() => {
    return processDataForChart(data, containerWidth, { xKey, yKey });
  }, [data, containerWidth, xKey, yKey]);

  return (
    <div ref={containerRef}>
      {wasSampled && (
        <div className="text-xs text-muted-foreground mb-2">
          Displaying {processedData.length} of {originalCount} data points
        </div>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={processedData}>
          {/* ... */}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

### Files to Update

1. `/components/dashboard/enhanced-chart-wrapper.tsx` - Add sampling to all chart types
2. `/components/dashboard/charts/line-chart.tsx` - If exists
3. `/components/dashboard/charts/scatter-chart.tsx` - If exists

---

## 3. Remove Unnecessary React.memo (15 minutes)

### Current Problem
`React.memo` on frequently-updating components adds overhead without benefits.

### Quick Fix

Remove `React.memo` from components that receive frequently-changing props:

```tsx
// ❌ BEFORE - enhanced-chart-wrapper.tsx
export const EnhancedChartWrapper = React.memo(function EnhancedChartWrapper({...}) {
  // Props change frequently, memo overhead > benefits
});

// ✅ AFTER
export function EnhancedChartWrapper({...}) {
  // Let it re-render naturally, use useMemo for expensive operations
  const processedData = useMemo(() => {
    return processChartData(data);
  }, [data]);
}
```

### Files to Update

1. `/components/dashboard/enhanced-chart-wrapper.tsx`
2. Any other chart wrappers with frequent prop changes

---

## 4. Debounce Resize Handlers (15 minutes)

### Current Problem
Resize events fire hundreds of times per second, causing excessive re-renders.

### Quick Fix

Already have `useDebounce` hook! Just apply it:

```tsx
// enhanced-chart-wrapper.tsx
const [containerWidth, setContainerWidth] = useState(0);

// Debounce the width value
const debouncedWidth = useDebounce(containerWidth, 200);

// Use debouncedWidth for calculations
const { processedData } = useMemo(() => {
  return processDataForChart(data, debouncedWidth);
}, [data, debouncedWidth]);
```

### Files to Update

1. `/components/dashboard/enhanced-chart-wrapper.tsx`
2. `/components/dashboard/flexible-dashboard-layout.tsx`

---

## 5. Batch Chart Updates (20 minutes)

### Current Status
✅ Already implemented `batchUpdateChartCustomizations` in store!

### Quick Fix

Use batch updates when modifying multiple charts:

```tsx
// ❌ BEFORE - Multiple re-renders
const updateMultipleCharts = () => {
  chartIds.forEach(id => {
    updateChartCustomization(id, { isVisible: true }); // Re-renders after each
  });
};

// ✅ AFTER - Single re-render
const updateMultipleCharts = () => {
  const updates = chartIds.reduce((acc, id) => {
    acc[id] = { isVisible: true };
    return acc;
  }, {});

  batchUpdateChartCustomizations(updates); // Re-renders once
};
```

### Files to Search & Update

Search for multiple calls to `updateChartCustomization` and replace with batch updates.

---

## 6. Add Web Vitals Monitoring (15 minutes)

### Quick Setup

Add to your root layout:

```tsx
// app/layout.tsx
'use client';

import { usePerformanceMonitoring } from '@/lib/utils/performance/web-vitals-monitor';

export default function RootLayout({ children }) {
  // Automatically logs performance metrics in development
  usePerformanceMonitoring();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

This will automatically track:
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)
- Memory usage

---

## 7. Optimize getFilteredData (30 minutes)

### Current Problem

`getFilteredData()` is called frequently but recalculates every time.

### Quick Fix

Already using it in a memoized way in components, but optimize the store method:

```tsx
// lib/store.ts - Add memoization to getFilteredData
import { create } from 'zustand';

// Add this helper outside the store
let cachedFilteredData: {
  data: DataRow[];
  dateRange: any;
  filters: any;
  granularity: string;
  result: DataRow[];
} | null = null;

export const useDataStore = create<DataStore>((set, get) => ({
  // ... state

  getFilteredData: () => {
    const state = get();
    const { rawData, dashboardFilters, dateRange, granularity } = state;

    // Return cached result if inputs haven't changed
    if (
      cachedFilteredData &&
      cachedFilteredData.data === rawData &&
      cachedFilteredData.dateRange === dateRange &&
      cachedFilteredData.filters === dashboardFilters &&
      cachedFilteredData.granularity === granularity
    ) {
      return cachedFilteredData.result;
    }

    // Calculate filtered data
    let filteredData = rawData;
    // ... existing filtering logic ...

    // Cache result
    cachedFilteredData = {
      data: rawData,
      dateRange,
      filters: dashboardFilters,
      granularity,
      result: filteredData,
    };

    return filteredData;
  },
}));
```

---

## 8. Add Performance Monitoring to Charts (20 minutes)

### Quick Setup

Add to your chart components:

```tsx
import { useChartPerformanceMonitor } from '@/lib/utils/performance/web-vitals-monitor';

const EnhancedChartWrapper = ({ id, data, ...props }) => {
  const { trackDataProcessing, trackRender } = useChartPerformanceMonitor(id);

  // Track data processing time
  const processedData = useMemo(() => {
    return trackDataProcessing(() => {
      return processChartData(data);
    });
  }, [data, trackDataProcessing]);

  // Track render time
  useEffect(() => {
    const endTracking = trackRender();
    return endTracking;
  });

  return <LineChart data={processedData} />;
};
```

---

## Testing & Verification

### Before Starting

1. **Baseline Measurement:**
   ```bash
   npm run dev
   ```
   - Open Chrome DevTools > Performance
   - Record a typical user interaction (load dashboard, filter data)
   - Note the render time and memory usage

### After Each Change

1. **Measure Improvement:**
   - Repeat the same user interaction
   - Compare render time and memory usage
   - Aim for 10-20% improvement per change

### Final Verification

Run Lighthouse audit:
```bash
npm run build
npm run start
```

- Open Chrome DevTools > Lighthouse
- Run audit for Performance
- Target scores:
  - Performance: >85
  - LCP: <2.5s
  - FID: <100ms

---

## Expected Results

| Optimization | Time | Impact |
|--------------|------|--------|
| Selective subscriptions | 30min | 15-20% fewer re-renders |
| Data sampling | 45min | 60-80% faster chart rendering |
| Remove React.memo | 15min | 5-10% less overhead |
| Debounce resize | 15min | 30-50% fewer calculations |
| Batch updates | 20min | 50% fewer re-renders |
| Web Vitals | 15min | Visibility into performance |
| Optimize filtering | 30min | 40-60% faster filtering |
| Chart monitoring | 20min | Identify bottlenecks |

**Total Time:** ~3 hours
**Total Expected Improvement:** 30-50% overall performance boost

---

## Troubleshooting

### If performance gets worse:
1. Check console for errors
2. Use React DevTools Profiler to identify regression
3. Revert last change and try next optimization

### If no improvement:
1. Profile with Chrome DevTools to find actual bottleneck
2. May be network-bound (check Network tab)
3. May be data processing (profile `processChartData`)

---

## Next Steps (After Quick Wins)

1. **Canvas Fallback for Large Datasets** (2-3 hours)
   - Implement Chart.js or ECharts for >1000 points

2. **Server Components Migration** (3-4 hours)
   - Move static parts to Server Components

3. **BigQuery Streaming** (4-6 hours)
   - Implement progressive data loading

---

## Resources

- Performance guide: `/PERFORMANCE_OPTIMIZATION_GUIDE.md`
- Data sampling utilities: `/lib/utils/performance/data-sampling.ts`
- Subscription helpers: `/lib/utils/performance/selective-subscriptions.ts`
- Monitoring utilities: `/lib/utils/performance/web-vitals-monitor.ts`
