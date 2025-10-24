# Filter Awareness - Quick Reference

## For Developers

### Using Chat Service with Filters

```typescript
import { sendChatMessage } from '@/lib/services/chat-service'

// Option 1: Auto-fetch from store (recommended)
const response = await sendChatMessage(
  message,
  data,
  fileName,
  conversationHistory,
  true  // useStreaming
)
// Filters automatically fetched from chart store

// Option 2: Manually provide filters
const filters = [
  { column: 'Region', operator: 'in', value: ['North', 'South'] },
  { column: 'Date', operator: '>=', value: '2024-01-01' }
]

const response = await sendChatMessage(
  message,
  data,
  fileName,
  conversationHistory,
  true,
  filters  // Explicitly pass filters
)
```

### Using Refresh Recommendations API

```typescript
// From client component
const response = await fetch('/api/recommendations/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: myData,
    schema: mySchema,
    correctedSchema: userCorrections,
    focus: 'trends',
    limit: 10,
    excludedTypes: ['pie', 'scatter'],
    activeFilters: [
      { column: 'Category', operator: 'in', value: ['A', 'B'] }
    ]
  })
})
```

### Filter Structure

```typescript
interface Filter {
  column: string      // Column name to filter
  operator: string    // 'in', '=', '!=', '>', '<', '>=', '<='
  value: any         // Value(s) to filter by
}
```

### Common Filter Operators

- **Text/Categorical**: `in`, `not in`, `=`, `!=`
- **Numeric**: `=`, `!=`, `>`, `<`, `>=`, `<=`, `between`
- **Date**: `=`, `>`, `<`, `>=`, `<=`, `between`

### AI Filter Suggestions

When AI suggests filters in recommendations:

```typescript
{
  "recommendations": [
    {
      "type": "bar",
      "title": "Top Regions by Sales",
      "dataMapping": {
        "xAxis": "Region",
        "yAxis": ["Sales"],
        "filters": [
          // AI suggests focusing on top 5 regions
          { "column": "Region", "operator": "in", "value": ["North", "South", "East", "West", "Central"] }
        ]
      }
      // ... rest of recommendation
    }
  ]
}
```

## For AI Prompt Engineers

### Filter Context in Prompts

The AI receives filter context in two scenarios:

**1. When Filters Are Active:**
```
ACTIVE DASHBOARD FILTERS:
The following filters are currently applied to the dashboard:
- Region in ["North","South"]
- Date >= "2024-01-01"

IMPORTANT FILTERING CONTEXT:
- The data being analyzed is filtered. Consider this context when generating recommendations.
- You can suggest additional filters in the dataMapping.filters field for each chart
- Filters help focus analysis on specific segments or time periods
```

**2. When No Filters Are Active:**
```
FILTERING CAPABILITIES:
The dashboard supports inline filtering on ALL chart fields:
- Text/Categorical fields: Multi-select specific items (like Excel filtering)
- Date fields: Aggregate by week, month, or year
- Numeric fields: Filter by value ranges
- You can suggest filters in the dataMapping.filters field to focus the analysis
- Example: filters: [{ column: "Region", operator: "in", value: ["North", "South"] }]
```

### Suggesting Filters in Responses

AI should suggest filters when:
- Focusing on top N performers
- Comparing specific segments
- Analyzing specific time periods
- Drilling down into categories
- Highlighting outliers or specific ranges

Example:
```json
{
  "dataMapping": {
    "xAxis": "Month",
    "yAxis": ["Revenue"],
    "filters": [
      { "column": "Product", "operator": "in", "value": ["Product A", "Product B"] },
      { "column": "Revenue", "operator": ">", "value": 10000 }
    ]
  }
}
```

## Testing Checklist

- [ ] Chat with no filters → AI explains filtering capabilities
- [ ] Chat with active filters → AI acknowledges filtered state
- [ ] Refresh recommendations with filters → AI considers context
- [ ] AI suggests filters in recommendations
- [ ] Suggested filters are syntactically valid
- [ ] Applied filters work correctly in charts

## Troubleshooting

**Issue**: Filters not being passed to AI
- Check that `dashboardFilters` is in chart store
- Verify API request includes `dashboardFilters` field
- Check console logs for filter count

**Issue**: AI doesn't suggest useful filters
- Review prompt context - is filter capability explained?
- Check if data sample shows filterable columns
- Ensure filter examples are in prompt

**Issue**: TypeScript errors with filters
- Verify filter structure matches `{ column, operator, value }`
- Check that `activeFilters` is optional in function signatures
- Ensure proper type imports from recommendation types

## Related Files

- `/app/api/recommendations/refresh/route.ts` - Recommendations API
- `/app/api/chat/route.ts` - Chat API  
- `/lib/services/chat-service.ts` - Chat client service
- `/lib/types/recommendation.ts` - Type definitions
- `/lib/stores/chart-store.ts` - Dashboard filters state

