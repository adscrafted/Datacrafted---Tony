# Formula System Quick Reference

## Common Formula Patterns

### Profitability
```javascript
// Profit Margin %
"(Revenue - Cost) / Revenue * 100"

// Gross Margin %
"(Revenue - COGS) / Revenue * 100"

// ROI %
"(Revenue - Cost) / Cost * 100"

// Markup %
"(Price - Cost) / Cost * 100"
```

### Efficiency & Returns
```javascript
// ROAS (Return on Ad Spend)
"SUM(Revenue) / SUM(Ad_Spend)"

// Operating Ratio %
"Operating_Expenses / Revenue * 100"

// Efficiency Ratio
"Total_Expenses / Revenue"
```

### E-commerce
```javascript
// Average Order Value
"SUM(Revenue) / SUM(Orders)"

// Conversion Rate %
"SUM(Orders) / SUM(Visitors) * 100"

// Cart Abandonment Rate %
"(Carts_Created - Orders) / Carts_Created * 100"

// Revenue per Visitor
"SUM(Revenue) / SUM(Visitors)"

// Items per Order
"SUM(Items) / SUM(Orders)"
```

### Marketing
```javascript
// Customer Acquisition Cost
"SUM(Marketing_Spend) / SUM(New_Customers)"

// Click-Through Rate %
"Clicks / Impressions * 100"

// Cost Per Click
"SUM(Ad_Spend) / SUM(Clicks)"

// LTV to CAC Ratio
"Customer_LTV / CAC"
```

### Financial
```javascript
// Current Ratio
"Current_Assets / Current_Liabilities"

// Debt to Equity
"Total_Debt / Total_Equity"

// Working Capital
"Current_Assets - Current_Liabilities"
```

## Chart Type Usage

### Scorecard (Single KPI)
```json
{
  "type": "scorecard",
  "dataMapping": {
    "formula": "SUM(Revenue) / SUM(Ad_Spend)",
    "formulaAlias": "ROAS",
    "formulaOptions": { "aggregateFirst": true, "round": 2 }
  }
}
```

### Bar Chart (per Category)
```json
{
  "type": "bar",
  "dataMapping": {
    "category": "Product",
    "formula": "(Revenue - Cost) / Revenue * 100",
    "formulaAlias": "Profit_Margin_Pct",
    "formulaOptions": { "round": 2 }
  }
}
```

### Line Chart (Trend over Time)
```json
{
  "type": "line",
  "dataMapping": {
    "xAxis": "Date",
    "formula": "Revenue / Orders",
    "formulaAlias": "AOV",
    "formulaOptions": { "round": 2 }
  }
}
```

## TypeScript Usage

### Basic Calculation
```typescript
import { calculateFormula } from '@/lib/utils/data-calculations'

const result = calculateFormula(
  data,
  '(Revenue - Cost) / Revenue * 100',
  'Profit_Margin',
  { round: 2 }
)
```

### Aggregated Calculation
```typescript
const result = calculateFormula(
  data,
  'SUM(Revenue) / SUM(Orders)',
  'AOV',
  { aggregateFirst: true, round: 2 }
)
```

### Validation
```typescript
import { validateFormulaComprehensive } from '@/lib/utils/formula-validator'

const validation = validateFormulaComprehensive(
  '(Revenue - Cost) / Revenue * 100',
  data
)

if (validation.valid) {
  console.log('Formula is valid!')
} else {
  console.error('Errors:', validation.errors)
}
```

### Find Pre-built Formulas
```typescript
import { findApplicableFormulas } from '@/lib/utils/common-formulas'

const columns = ['Revenue', 'Cost', 'Orders']
const applicable = findApplicableFormulas(columns)

applicable.forEach(formula => {
  console.log(`${formula.name}: ${formula.formula}`)
})
```

## Syntax Rules

✅ **DO:**
- Use exact column names from your data
- Wrap columns with spaces in brackets: `[Total Sales]`
- Use SUM(), AVG(), COUNT() for aggregations
- Multiply by 100 for percentages
- Use parentheses for order of operations

❌ **DON'T:**
- Use column names that don't exist
- Forget to multiply by 100 for percentages
- Create overly complex formulas (>50 operations)
- Use dangerous characters: `;`, `` ` ``, `$`, `{`, `}`

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Column not found" | Check spelling and capitalization |
| "Division by zero" | Filter data or check for zero values |
| "Formula too complex" | Break into multiple calculated columns |
| "Invalid characters" | Remove special characters |

## Performance Tips

1. Use `aggregateFirst: true` for scorecards
2. Round results with `round: 2`
3. Filter large datasets before calculating
4. Avoid deep nesting (max 3 levels of parentheses)

## Common Patterns

### Percentage Calculation
```javascript
// Pattern: (Part / Total) * 100
"(Clicks / Impressions) * 100"
```

### Ratio Calculation
```javascript
// Pattern: A / B
"Revenue / Ad_Spend"
```

### Margin Calculation
```javascript
// Pattern: (Revenue - Cost) / Revenue * 100
"(Revenue - Cost) / Revenue * 100"
```

### Average Calculation
```javascript
// Pattern: SUM(Total) / SUM(Count)
"SUM(Revenue) / SUM(Orders)"
```

## Example: E-commerce Dashboard

```typescript
// 1. Total Revenue
{ formula: "SUM(Revenue)", formulaAlias: "Total_Revenue" }

// 2. Total Profit
{ formula: "SUM(Revenue) - SUM(Cost)", formulaAlias: "Total_Profit" }

// 3. Profit Margin %
{ formula: "(SUM(Revenue) - SUM(Cost)) / SUM(Revenue) * 100", formulaAlias: "Profit_Margin_Pct" }

// 4. Average Order Value
{ formula: "SUM(Revenue) / SUM(Orders)", formulaAlias: "AOV" }

// 5. Conversion Rate %
{ formula: "SUM(Orders) / SUM(Visitors) * 100", formulaAlias: "Conversion_Rate_Pct" }

// 6. ROAS
{ formula: "SUM(Revenue) / SUM(Ad_Spend)", formulaAlias: "ROAS" }
```

All formulas use `{ aggregateFirst: true, round: 2 }` for scorecards.
