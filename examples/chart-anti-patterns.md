# React Chart Performance Anti-Patterns

**What NOT to do when building chart dashboards**

This document shows common performance mistakes and how to fix them.

---

## Anti-Pattern 1: Creating New Objects/Arrays in Render

### ❌ Bad

```tsx
function ChartContainer({ data }: Props) {
  return (
    <MemoizedChart
      data={data}
      colors={['#0088FE', '#00C49F', '#FFBB28']} // New array every render!
      config={{ showGrid: true, showLegend: true }} // New object every render!
      onItemClick={(item) => console.log(item)} // New function every render!
    />
  )
}

// Result: MemoizedChart re-renders EVERY time parent renders
// even though the actual values haven't changed
```

### ✅ Good

```tsx
// Option 1: Constants outside component
const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28']
const DEFAULT_CONFIG = { showGrid: true, showLegend: true }

function ChartContainer({ data }: Props) {
  const handleItemClick = useCallback((item) => {
    console.log(item)
  }, [])

  return (
    <MemoizedChart
      data={data}
      colors={CHART_COLORS}
      config={DEFAULT_CONFIG}
      onItemClick={handleItemClick}
    />
  )
}

// Option 2: useMemo for dynamic values
function ChartContainer({ data, theme }: Props) {
  const colors = useMemo(() =>
    theme === 'dark' ? DARK_COLORS : LIGHT_COLORS,
    [theme]
  )

  const config = useMemo(() => ({
    showGrid: true,
    showLegend: theme !== 'minimal'
  }), [theme])

  return <MemoizedChart data={data} colors={colors} config={config} />
}
```

**Why This Matters**:
- React.memo uses shallow comparison
- New objects/arrays always fail equality check
- Chart re-renders unnecessarily = wasted time

---

## Anti-Pattern 2: Using Array Index as Key

### ❌ Bad

```tsx
function Dashboard({ charts }: Props) {
  return (
    <div>
      {charts.map((chart, index) => (
        <ChartWrapper key={index} {...chart} />
      ))}
    </div>
  )
}

// Problems:
// 1. When charts reorder, React can't track which is which
// 2. State gets mixed up between charts
// 3. Animations break
// 4. Unnecessary re-renders
```

### ✅ Good

```tsx
function Dashboard({ charts }: Props) {
  return (
    <div>
      {charts.map(chart => (
        <ChartWrapper key={chart.id} {...chart} />
      ))}
    </div>
  )
}

// If no ID exists, generate stable one:
function Dashboard({ charts }: Props) {
  return (
    <div>
      {charts.map((chart, index) => (
        <ChartWrapper
          key={chart.id || `${chart.type}-${chart.title}-${index}`}
          {...chart}
        />
      ))}
    </div>
  )
}
```

**Real-World Impact**:
- User adds/removes chart → all charts re-render
- Filters change order → charts lose state
- Drag-to-reorder → chaos

---

## Anti-Pattern 3: Expensive Operations in Render

### ❌ Bad

```tsx
function ChartComponent({ data }: Props) {
  // THESE RUN ON EVERY RENDER!
  const sorted = data.sort((a, b) => b.value - a.value) // Mutates original!
  const filtered = sorted.filter(d => d.active) // Every render!
  const aggregated = filtered.reduce((acc, d) => { // Every render!
    acc[d.category] = (acc[d.category] || 0) + d.value
    return acc
  }, {})

  return <BarChart data={Object.entries(aggregated)} />
}

// If parent re-renders 10 times/second during drag,
// this processing happens 10 times/second!
```

### ✅ Good

```tsx
function ChartComponent({ data }: Props) {
  const processedData = useMemo(() => {
    // Copy to avoid mutation
    const sorted = [...data].sort((a, b) => b.value - a.value)
    const filtered = sorted.filter(d => d.active)

    const aggregated = filtered.reduce((acc, d) => {
      acc[d.category] = (acc[d.category] || 0) + d.value
      return acc
    }, {} as Record<string, number>)

    return Object.entries(aggregated).map(([name, value]) => ({
      name,
      value
    }))
  }, [data]) // Only recalculate when data changes

  return <BarChart data={processedData} />
}
```

**Benchmark**:
- 1000 rows, 10 renders/sec
- Bad: 10 × 50ms = 500ms of wasted CPU
- Good: 1 × 50ms = 50ms total

---

## Anti-Pattern 4: Not Cleaning Up Side Effects

### ❌ Bad

```tsx
function RealTimeChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    // Start interval
    const interval = setInterval(() => {
      fetchData().then(newData => setData(newData))
    }, 1000)
    // No cleanup! Interval keeps running after unmount
  }, [])

  return <LineChart data={data} />
}

// Result: Memory leak, errors when component unmounts
```

### ✅ Good

```tsx
function RealTimeChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchData().then(newData => setData(newData))
    }, 1000)

    // Cleanup function
    return () => clearInterval(interval)
  }, [])

  return <LineChart data={data} />
}

// Better: Also handle mounting/unmounting
function RealTimeChart() {
  const [data, setData] = useState([])
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const interval = setInterval(() => {
      fetchData().then(newData => {
        // Only update if still mounted
        if (mountedRef.current) {
          setData(newData)
        }
      })
    }, 1000)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  return <LineChart data={data} />
}
```

**Common Side Effects That Need Cleanup**:
- `setInterval` / `setTimeout`
- Event listeners
- Subscriptions
- WebSocket connections
- ResizeObserver / IntersectionObserver
- Animation frames

---

## Anti-Pattern 5: Over-Memoization

### ❌ Bad

```tsx
function ChartComponent({ data }: Props) {
  // Over-memoizing cheap operations
  const count = useMemo(() => data.length, [data]) // Overhead > benefit
  const isEmpty = useMemo(() => count === 0, [count]) // Unnecessary
  const title = useMemo(() => `Chart (${count} items)`, [count]) // Unnecessary
  const showChart = useMemo(() => !isEmpty, [isEmpty]) // Unnecessary

  // The memoization overhead is MORE expensive than the operations!

  return showChart ? <div>{title}</div> : null
}
```

### ✅ Good

```tsx
function ChartComponent({ data }: Props) {
  // Don't memoize cheap operations
  const count = data.length
  const isEmpty = count === 0
  const title = `Chart (${count} items)`
  const showChart = !isEmpty

  // Only memoize expensive operations
  const processedData = useMemo(() => {
    return data
      .filter(item => item.value > 0)
      .map(item => ({
        ...item,
        normalized: item.value / count
      }))
      .sort((a, b) => b.normalized - a.normalized)
  }, [data, count])

  return showChart ? (
    <div>
      <h3>{title}</h3>
      <LineChart data={processedData} />
    </div>
  ) : null
}
```

**When to Use useMemo**:
- ✅ Data transformations (filter, map, sort on large arrays)
- ✅ Complex calculations
- ✅ Creating objects/arrays for memoized components
- ❌ Simple math operations
- ❌ String concatenation
- ❌ Boolean logic
- ❌ Array.length

**Rule of Thumb**: If operation takes <1ms, don't memoize

---

## Anti-Pattern 6: Inline Functions in Loops

### ❌ Bad

```tsx
function Dashboard({ charts }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div>
      {charts.map(chart => (
        <ChartWrapper
          key={chart.id}
          data={chart.data}
          // New function on every render for every chart!
          onClick={() => setSelected(chart.id)}
        />
      ))}
    </div>
  )
}

// With 20 charts: 20 new functions on every parent re-render
```

### ✅ Good

```tsx
function Dashboard({ charts }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  // Single stable callback
  const handleChartClick = useCallback((chartId: string) => {
    setSelected(chartId)
  }, [])

  return (
    <div>
      {charts.map(chart => (
        <ChartWrapper
          key={chart.id}
          data={chart.data}
          chartId={chart.id}
          onClick={handleChartClick}
        />
      ))}
    </div>
  )
}

// ChartWrapper implementation
const ChartWrapper = memo(function ChartWrapper({ chartId, data, onClick }: Props) {
  const handleClick = useCallback(() => {
    onClick(chartId)
  }, [chartId, onClick])

  return <div onClick={handleClick}>{/* chart content */}</div>
})
```

---

## Anti-Pattern 7: Not Limiting Rendered Data

### ❌ Bad

```tsx
function TableChart({ data }: Props) {
  return (
    <table>
      <tbody>
        {/* Rendering ALL 10,000 rows! */}
        {data.map((row, index) => (
          <tr key={index}>
            {Object.values(row).map((cell, i) => (
              <td key={i}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Result: 10,000 DOM nodes, 5+ second render, browser freeze
```

### ✅ Good

```tsx
// Option 1: Pagination
function TableChart({ data }: Props) {
  const [page, setPage] = useState(0)
  const pageSize = 50

  const visibleData = useMemo(() =>
    data.slice(page * pageSize, (page + 1) * pageSize),
    [data, page, pageSize]
  )

  return (
    <div>
      <table>
        <tbody>
          {visibleData.map((row, index) => (
            <tr key={index}>
              {Object.values(row).map((cell, i) => (
                <td key={i}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button onClick={() => setPage(p => Math.max(0, p - 1))}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}

// Option 2: Virtual scrolling (for 1000+ rows)
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualTableChart({ data }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <TableRow data={data[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Performance Difference**:
- Rendering 10,000 rows: 5000ms, 10,000 DOM nodes
- Rendering 50 rows: 50ms, 50 DOM nodes
- Virtual scrolling 10,000 rows: 50ms, ~15 DOM nodes

---

## Anti-Pattern 8: Mutating Props/State

### ❌ Bad

```tsx
function ChartComponent({ data }: Props) {
  const sortedData = useMemo(() => {
    // MUTATION! This changes the original array
    return data.sort((a, b) => b.value - a.value)
  }, [data])

  return <BarChart data={sortedData} />
}

// Problems:
// 1. Parent's data array is now sorted (side effect!)
// 2. Can cause bugs in sibling components
// 3. Violates React's immutability principle
```

### ✅ Good

```tsx
function ChartComponent({ data }: Props) {
  const sortedData = useMemo(() => {
    // Copy first, then sort
    return [...data].sort((a, b) => b.value - a.value)
  }, [data])

  return <BarChart data={sortedData} />
}

// For objects
function ChartComponent({ data }: Props) {
  const modifiedData = useMemo(() => {
    return data.map(item => ({
      ...item, // Copy object
      normalized: item.value / 100
    }))
  }, [data])

  return <BarChart data={modifiedData} />
}
```

**Mutating Methods to Avoid**:
- `array.sort()` → use `[...array].sort()`
- `array.reverse()` → use `[...array].reverse()`
- `array.push()` → use `[...array, newItem]`
- `array.splice()` → use `array.filter()` or `array.slice()`
- `object.property = value` → use `{ ...object, property: value }`

---

## Anti-Pattern 9: Blocking the UI Thread

### ❌ Bad

```tsx
function ChartComponent({ rawData }: Props) {
  const [processedData, setProcessedData] = useState([])

  useEffect(() => {
    // Heavy computation on main thread - blocks UI!
    const processed = rawData.map(row => ({
      ...row,
      // Complex calculation for each of 10,000 rows
      score: complexAlgorithm(row)
    }))

    setProcessedData(processed)
  }, [rawData])

  return <LineChart data={processedData} />
}

// Result: UI freezes for 2 seconds
```

### ✅ Good

```tsx
// Option 1: Use Web Worker
function ChartComponent({ rawData }: Props) {
  const [processedData, setProcessedData] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    setIsProcessing(true)

    const worker = new Worker('/workers/data-processor.js')

    worker.postMessage({ data: rawData })

    worker.onmessage = (e) => {
      setProcessedData(e.data)
      setIsProcessing(false)
      worker.terminate()
    }

    return () => worker.terminate()
  }, [rawData])

  if (isProcessing) {
    return <div>Processing data...</div>
  }

  return <LineChart data={processedData} />
}

// Option 2: Break into chunks with setTimeout
function ChartComponent({ rawData }: Props) {
  const [processedData, setProcessedData] = useState([])

  useEffect(() => {
    const chunkSize = 100
    let index = 0
    const results: any[] = []

    function processChunk() {
      const chunk = rawData.slice(index, index + chunkSize)

      chunk.forEach(row => {
        results.push({
          ...row,
          score: complexAlgorithm(row)
        })
      })

      index += chunkSize

      if (index < rawData.length) {
        // Process next chunk on next frame
        requestAnimationFrame(processChunk)
      } else {
        setProcessedData(results)
      }
    }

    processChunk()
  }, [rawData])

  return <LineChart data={processedData} />
}
```

---

## Anti-Pattern 10: Not Using Zustand Selectors Properly

### ❌ Bad

```tsx
function ChartComponent() {
  // Subscribes to ENTIRE store!
  // Re-renders on ANY store change
  const store = useDataStore()

  return <LineChart data={store.filteredData} />
}

// If user changes unrelated settings, this chart re-renders!
```

### ✅ Good

```tsx
// Option 1: Direct selector
function ChartComponent() {
  const filteredData = useDataStore(state => state.filteredData)

  return <LineChart data={filteredData} />
}

// Option 2: Multiple selectors with useShallow
import { useShallow } from 'zustand/react/shallow'

function ChartComponent() {
  const { data, dateRange, filters } = useDataStore(
    useShallow(state => ({
      data: state.getFilteredData(),
      dateRange: state.dateRange,
      filters: state.filters
    }))
  )

  return <LineChart data={data} />
}

// Option 3: Primitive selectors (best performance)
function ChartComponent() {
  const data = useDataStore(state => ({
    filtered: state.getFilteredData(),
    // Extract primitives for proper equality checks
    dateFrom: state.dateRange?.from?.getTime(),
    dateTo: state.dateRange?.to?.getTime(),
  }))

  const chartData = useMemo(() => {
    return data.filtered
  }, [data.filtered, data.dateFrom, data.dateTo])

  return <LineChart data={chartData} />
}
```

**Performance Impact**:
- Bad: 100 re-renders when changing unrelated state
- Good: 2 re-renders when only relevant data changes

---

## Anti-Pattern 11: Loading All Data Upfront

### ❌ Bad

```tsx
function Dashboard() {
  const [allData, setAllData] = useState([])

  useEffect(() => {
    // Load 100MB of data on mount
    fetch('/api/all-data')
      .then(res => res.json())
      .then(data => setAllData(data))
  }, [])

  return (
    <div>
      {allData.map(dataset => (
        <ChartWrapper key={dataset.id} data={dataset.data} />
      ))}
    </div>
  )
}

// Result: 30 second load time, browser freeze
```

### ✅ Good

```tsx
// Option 1: Load on demand
function Dashboard() {
  const [visibleCharts, setVisibleCharts] = useState<string[]>([])

  const loadChartData = useCallback((chartId: string) => {
    return fetch(`/api/chart-data/${chartId}`)
      .then(res => res.json())
  }, [])

  return (
    <div>
      {chartConfigs.map(config => (
        <LazyChart
          key={config.id}
          config={config}
          loadData={loadChartData}
        />
      ))}
    </div>
  )
}

// Option 2: Pagination
function Dashboard() {
  const [page, setPage] = useState(0)
  const [data, setData] = useState([])

  useEffect(() => {
    fetch(`/api/data?page=${page}&limit=10`)
      .then(res => res.json())
      .then(pageData => setData(pageData))
  }, [page])

  return (
    <div>
      {data.map(chart => (
        <ChartWrapper key={chart.id} {...chart} />
      ))}

      <Pagination page={page} onChange={setPage} />
    </div>
  )
}
```

---

## Anti-Pattern 12: Recharts-Specific: Not Optimizing for Large Datasets

### ❌ Bad

```tsx
function LargeDataChart({ data }: Props) {
  // 10,000 data points with all features enabled
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}> {/* 10,000 points! */}
        <CartesianGrid strokeDasharray="3 3" /> {/* Slow! */}
        <XAxis dataKey="x" />
        <YAxis />
        <Tooltip /> {/* Hover lag */}
        <Legend />
        <Line
          type="monotone"
          dataKey="y"
          stroke="#8884d8"
          dot={true} {/* 10,000 dots! */}
          isAnimationActive={true} {/* Slow animation */}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Result: 3 second render, laggy interactions
```

### ✅ Good

```tsx
function LargeDataChart({ data }: Props) {
  // Decimate data to ~500 points
  const decimatedData = useMemo(() => {
    if (data.length <= 500) return data
    return downsampleLTTB(data, 500)
  }, [data])

  const isLarge = data.length > 500

  return (
    <div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={decimatedData}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false} // Only horizontal lines
          />
          <XAxis dataKey="x" />
          <YAxis />
          <Tooltip
            isAnimationActive={false} // No animation for better performance
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="y"
            stroke="#8884d8"
            dot={!isLarge} // No dots for large datasets
            isAnimationActive={!isLarge} // Disable animation
          />
        </LineChart>
      </ResponsiveContainer>

      {isLarge && (
        <p className="text-sm text-gray-500 mt-2">
          Showing {decimatedData.length} of {data.length} points (optimized for performance)
        </p>
      )}
    </div>
  )
}
```

**Performance Improvements**:
- Render time: 3000ms → 150ms (20x faster)
- Hover lag: 200ms → 16ms (smooth 60fps)
- Memory usage: 80MB → 15MB

---

## Summary: Common Mistakes Checklist

### Data & State
- [ ] ❌ Creating new objects/arrays in render
- [ ] ❌ Mutating props or state
- [ ] ❌ Using array index as key
- [ ] ❌ Not limiting rendered data

### Performance
- [ ] ❌ Expensive operations in render (not memoized)
- [ ] ❌ Over-memoization of cheap operations
- [ ] ❌ Inline functions in loops
- [ ] ❌ Blocking UI thread with heavy computation

### Side Effects
- [ ] ❌ Not cleaning up intervals/subscriptions
- [ ] ❌ Not handling component unmount
- [ ] ❌ Memory leaks from event listeners

### Store/State Management
- [ ] ❌ Subscribing to entire Zustand store
- [ ] ❌ Not using proper selectors
- [ ] ❌ Multiple setState calls instead of batching

### Recharts-Specific
- [ ] ❌ Rendering 1000+ data points without decimation
- [ ] ❌ Enabling animations for large datasets
- [ ] ❌ Showing dots/markers on every point
- [ ] ❌ Not disabling grid for performance

---

## Quick Fix Guide

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Chart re-renders on every parent render | Not using React.memo | Wrap in `memo()` with custom comparison |
| Slow initial load | Too much data | Add data decimation (LTTB) |
| Laggy drag/resize | Too many updates | Throttle position updates (150ms) |
| High memory usage | Not cleaning up | Add cleanup in useEffect return |
| UI freezes during processing | Blocking main thread | Use Web Worker or chunk processing |
| Chart "jumps" when reordering | Using index as key | Use stable IDs |
| Every component re-renders | Subscribing to entire store | Use Zustand selectors |
| Hover lag on tooltip | Too many data points | Decimate data + disable animations |

---

**Remember**: Profile first, optimize second. Don't guess!
