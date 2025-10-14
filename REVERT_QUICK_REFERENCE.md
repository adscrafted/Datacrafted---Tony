# Quick Reference: Lost Changes Recovery Guide

## TL;DR - What Was Lost?

### ✅ Recoverable (Uncommitted, Still in Working Directory)
- **Authentication & Middleware** - Just needs to be committed
- Time to recover: **5 minutes**

### ❌ Lost (Needs Reimplementation)
- **Gauge Chart Aggregation** - Complete redesign needed
- **Infinite Loop Fixes** - useShallow pattern needed
- Time to reimplement: **2-3 hours**

---

## Quick Recovery Commands

### 1. Save Authentication Changes (Immediate Action)

```bash
cd "/Users/tonynham/Desktop/APPS/Datacrafted - Anthonys Version:New Working Version/datacrafted"

# Stage all auth/middleware files
git add .env.example
git add app/api/analyze/route.ts
git add app/api/chat/route.ts
git add app/api/sessions/
git add lib/middleware/
git add lib/auth/
git add middleware.ts
git add components/auth/

# Commit
git commit -m "Add authentication and rate limiting middleware"

# Push
git push origin main
```

---

## 2. Gauge Chart Aggregation (Reimplementation Needed)

### Current State (Simple)
```typescript
// Just shows first row value
const value = data[0]?.[metric]
```

### Target State (Aggregated)
```typescript
// Aggregates across all rows
dataMapping: {
  metric: string;
  aggregation: 'sum' | 'average' | 'median' | 'min' | 'max' | 'count';
  max?: number;
  min?: number;
}
```

### Files to Update
1. `/components/dashboard/charts/gauge-chart.tsx`
   - Add aggregation parameter
   - Implement aggregation logic (sum/avg/median/min/max/count)

2. `/components/dashboard/chart-customization-panel.tsx`
   - Add aggregation dropdown
   - Add max/min number inputs

3. `/components/dashboard/enhanced-chart-wrapper.tsx`
   - Pass aggregation to GaugeChart component

4. `/app/api/analyze/route.ts`
   - Add aggregation validation for gauge charts

### Implementation Snippet (gauge-chart.tsx)
```typescript
// Replace lines 48-103
const gaugeData = useMemo(() => {
  const { metric, aggregation, max: userMax, min: userMin = 0 } = dataMapping;

  // Extract values
  const values = data.map(row => Number(row[metric]) || 0).filter(v => !isNaN(v));

  // Calculate aggregation
  let result = 0;
  switch (aggregation) {
    case 'sum': result = values.reduce((a, b) => a + b, 0); break;
    case 'average': result = values.reduce((a, b) => a + b, 0) / values.length; break;
    case 'median':
      const sorted = [...values].sort((a, b) => a - b);
      result = sorted[Math.floor(sorted.length / 2)];
      break;
    case 'min': result = Math.min(...values); break;
    case 'max': result = Math.max(...values); break;
    case 'count': result = values.length; break;
  }

  // Calculate percentage
  const maxValue = userMax ?? 100;
  const percentage = ((result - userMin) / (maxValue - userMin)) * 100;

  return { value: result, percentage, max: maxValue, min: userMin };
}, [data, dataMapping]);
```

---

## 3. Infinite Loop Fixes (useShallow Pattern)

### Problem
```
Warning: Cannot update a component while rendering a different component.
Error: getSnapshot should be cached to avoid an infinite loop
```

### Solution: Use `useShallow`

**Install if needed:**
```bash
npm install zustand@latest
```

### Pattern to Apply

**Before (Causes Infinite Loop):**
```typescript
const { prop1, prop2, func1 } = useDataStore()
```

**After (Stable Subscriptions):**
```typescript
import { useShallow } from 'zustand/react/shallow'

const { prop1, prop2, func1 } = useDataStore(useShallow((state) => ({
  prop1: state.prop1,
  prop2: state.prop2,
  func1: state.func1
})))
```

### Files to Update (Priority Order)

1. **`/components/dashboard/enhanced-chart-wrapper.tsx`** (HIGH)
   - Line ~180-220: Add useShallow
   - Most critical for chart rendering

2. **`/components/dashboard/flexible-dashboard-layout.tsx`** (HIGH)
   - Line 66-98: Add useShallow
   - 30+ store subscriptions need wrapping

3. **`/app/dashboard/page.tsx`** (MEDIUM)
   - Line 76-101: Add useShallow
   - Two separate store calls to fix

4. **Other files if they exist:**
   - `/components/dashboard/chart-wrapper.tsx`
   - `/components/dashboard/advanced-filter-system.tsx`
   - `/lib/utils/performance/selective-subscriptions.ts`

### Quick Fix Template

```typescript
// 1. Add import
import { useShallow } from 'zustand/react/shallow'

// 2. Replace destructuring
const storeState = useDataStore(useShallow((state) => ({
  // List ONLY the properties you use in this component
  propName: state.propName,
  funcName: state.funcName,
  // ...
})))

// 3. Destructure from storeState
const { propName, funcName } = storeState
```

---

## 4. getFilteredData Dependency Fix

### Files to Check

**Pattern (already correct in flexible-dashboard-layout.tsx):**
```typescript
const filteredData = useMemo(() => {
  const result = getFilteredData()
  if (result.length === 0 && data.length > 0) {
    return data
  }
  return result
}, [getFilteredData, dateRange, granularity, selectedDateColumn, data.length, data])
//    ^^^^^^^^^ Include ALL dependencies that affect the result
```

**Verify in:**
- `/app/dashboard/page.tsx` (line ~278-286)
- Any component calling `getFilteredData()`

---

## 5. Testing Checklist

After reimplementation, verify:

### Authentication
- [ ] Can log in with Firebase
- [ ] API returns 401 when not authenticated
- [ ] Rate limiting works (10 requests/hour for analysis)
- [ ] Debug mode works in development

### Gauge Charts
- [ ] Aggregation dropdown appears
- [ ] Sum calculation works correctly
- [ ] Average calculation works correctly
- [ ] Max/Min inputs appear
- [ ] Gauge displays correct percentage

### Infinite Loops
- [ ] No "getSnapshot should be cached" errors in console
- [ ] Dashboard renders without lag
- [ ] No infinite re-renders when dragging charts
- [ ] No console warnings about component updates

---

## 6. File Change Summary

### Modified (Uncommitted - Can Commit Now)
| File | Change | Lines |
|------|--------|-------|
| `.env.example` | Firebase Admin SDK config | +20 |
| `app/api/analyze/route.ts` | Auth middleware | -26, +2 |
| `app/api/chat/route.ts` | Auth middleware | - |
| `app/api/sessions/*/route.ts` | Auth middleware | - |

### New Files (Untracked - Can Commit Now)
- `lib/middleware/auth.ts`
- `lib/middleware/rate-limit.ts`
- `lib/auth/*`
- `middleware.ts`
- `components/auth/*`

### Need Reimplementation (Lost)
| File | What's Missing | Est. Time |
|------|----------------|-----------|
| `components/dashboard/charts/gauge-chart.tsx` | Aggregation logic | 30 min |
| `components/dashboard/chart-customization-panel.tsx` | Gauge UI controls | 30 min |
| `components/dashboard/enhanced-chart-wrapper.tsx` | useShallow + gauge props | 15 min |
| `components/dashboard/flexible-dashboard-layout.tsx` | useShallow | 15 min |
| `app/dashboard/page.tsx` | useShallow | 10 min |
| Other components | useShallow (if needed) | 20 min |
| **Total** | | **~2 hours** |

---

## 7. Priority Order

### 🔴 Critical (Do First)
1. **Commit auth changes** (5 min) - Prevent losing work again
2. **Fix infinite loops** (30 min) - Blocking user experience

### 🟡 Important (Do Second)
3. **Reimplement gauge aggregation** (1.5 hours) - Feature enhancement

### 🟢 Nice to Have
4. Comprehensive testing
5. Documentation updates

---

## 8. Emergency Recovery

If you accidentally lose uncommitted changes again:

```bash
# Check reflog
git reflog

# Check stash
git stash list

# Check file history
git fsck --lost-found

# Recover from .git/objects if needed
ls -la .git/objects/
```

---

## 9. Prevention Tips

1. **Commit early, commit often**
   ```bash
   # Every 30 minutes or after each logical change
   git add .
   git commit -m "WIP: description"
   ```

2. **Use feature branches**
   ```bash
   git checkout -b feature/gauge-charts
   # Work on feature
   git commit -m "Complete gauge charts"
   git checkout main
   git merge feature/gauge-charts
   ```

3. **Stash before resets**
   ```bash
   git stash save "Before reset - gauge and loop fixes"
   # Do risky operation
   git stash pop  # If needed
   ```

4. **Daily backups**
   ```bash
   # Create backup branch
   git branch backup-2025-10-11
   ```

---

## 10. Quick Links

- Full Report: `REVERT_ANALYSIS_REPORT.md`
- Gauge Implementation: See Section 2 above
- useShallow Pattern: See Section 3 above
- Testing Checklist: See Section 5 above

---

## Need Help?

### Gauge Chart Issues
- Check AI validation: `app/api/analyze/route.ts` line 1406-1417
- Check dataMapping: `components/dashboard/charts/gauge-chart.tsx` line 12-16
- Check UI: `components/dashboard/chart-customization-panel.tsx`

### Infinite Loop Issues
- Search for: `useDataStore()` (without useShallow)
- Replace with: `useDataStore(useShallow(...))`
- Pattern in Section 3

### Authentication Issues
- Check `.env.example` for Firebase config
- Check `lib/middleware/auth.ts` for implementation
- Test with: `curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/analyze`
