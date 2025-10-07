# Formula Calculation System - Complete Documentation

## Overview

A comprehensive, production-ready formula calculation system that enables AI-powered dynamic metric creation for financial, e-commerce, and operational KPIs.

### Key Features

- **Safe Formula Parsing**: Tokenizes and validates formulas with security checks
- **Rich Operator Support**: Basic arithmetic (+, -, *, /), parentheses, aggregate functions
- **Column Name Normalization**: Handles spaces, underscores, case variations
- **Pre-built Formula Library**: 25+ common business formulas ready to use
- **AI Integration**: OpenAI can now suggest calculated metrics based on available data
- **Type Safety**: Comprehensive TypeScript typing throughout
- **Performance**: Optimized for datasets up to 10,000 rows

---

## Architecture

### Core Components

```
lib/utils/
├── formula-parser.ts           # Tokenizes and evaluates formulas
├── formula-validator.ts        # Validates formulas against data
├── common-formulas.ts          # Library of pre-built formulas
├── data-calculations.ts        # Integration with calculation engine
└── chart-data-processor.ts    # Chart-specific formula processing
```

### Data Flow

```
User/AI Request
    ↓
Formula String: "(Revenue - Cost) / Revenue * 100"
    ↓
Tokenizer (formula-parser.ts)
    ↓
Tokens: [paren, column, operator, column, paren, operator, column, operator, number]
    ↓
Validator (formula-validator.ts)
    ↓
✅ Valid (columns exist, syntax correct, no div by zero)
    ↓
Calculator (data-calculations.ts)
    ↓
Results: [{ Product: "A", Profit_Margin: 40 }, ...]
    ↓
Chart Processor (chart-data-processor.ts)
    ↓
Rendered Chart
```

---

## Usage Examples

### 1. Basic Formula Calculation

```typescript
import { calculateFormula } from '@/lib/utils/data-calculations'

const data = [
  { Revenue: 1000, Cost: 600, Orders: 10 },
  { Revenue: 1500, Cost: 900, Orders: 15 }
]

// Calculate profit margin for each row
const result = calculateFormula(
  data,
  '(Revenue - Cost) / Revenue * 100',
  'Profit_Margin',
  { round: 2 }
)

console.log(result.data)
// [
//   { Revenue: 1000, Cost: 600, Orders: 10, Profit_Margin: 40 },
//   { Revenue: 1500, Cost: 900, Orders: 15, Profit_Margin: 40 }
// ]
```

### 2. Aggregated Formula (Scorecard)

```typescript
// Calculate total ROAS across all data
const result = calculateFormula(
  data,
  'SUM(Revenue) / SUM(Ad_Spend)',
  'ROAS',
  { aggregateFirst: true, round: 2 }
)

console.log(result.data)
// [{ ROAS: 5.2 }]
```

### 3. Using with Chart Data Processor

```typescript
import { processScoreCardData } from '@/lib/utils/chart-data-processor'

const chartData = processScoreCardData(data, {
  formula: 'SUM(Revenue) / SUM(Orders)',
  formulaAlias: 'Average_Order_Value',
  formulaOptions: {
    aggregateFirst: true,
    round: 2
  }
})
```

### 4. AI-Generated Formula (via OpenAI)

```json
{
  "type": "scorecard",
  "title": "Overall ROAS",
  "dataMapping": {
    "formula": "SUM(Revenue) / SUM(Ad_Spend)",
    "formulaAlias": "ROAS",
    "formulaOptions": { "aggregateFirst": true, "round": 2 }
  }
}
```

---

## Formula Syntax Reference

### Basic Operations

| Operator | Description | Example |
|----------|-------------|---------|
| `+` | Addition | `Revenue + Bonus` |
| `-` | Subtraction | `Revenue - Cost` |
| `*` | Multiplication | `Price * Quantity` |
| `/` | Division | `Revenue / Orders` |
| `%` | Modulo | `Total % 100` |
| `( )` | Parentheses | `(A + B) * C` |

### Aggregate Functions

| Function | Description | Example |
|----------|-------------|---------|
| `SUM(column)` | Sum all values | `SUM(Revenue)` |
| `AVG(column)` | Average of values | `AVG(Order_Value)` |
| `COUNT(column)` | Count non-null values | `COUNT(Customer_ID)` |
| `MIN(column)` | Minimum value | `MIN(Price)` |
| `MAX(column)` | Maximum value | `MAX(Sales)` |

### Column References

```typescript
// Simple column name
"Revenue"

// Column with spaces (must use brackets)
"[Total Sales]"

// Column with special characters
"[Ad-Spend-2024]"

// Case-insensitive (automatic matching)
"revenue" → matches "Revenue"
```

---

## Common Business Formulas

### Profitability Metrics

#### Profit Margin %
```
(Revenue - Cost) / Revenue * 100
```
**Use case**: Measure profitability per product/campaign
**Output**: Percentage (e.g., 35.5%)

#### Gross Margin %
```
(Revenue - COGS) / Revenue * 100
```
**Use case**: Production efficiency
**Output**: Percentage

#### ROI %
```
(Revenue - Cost) / Cost * 100
```
**Use case**: Return on investment
**Output**: Percentage (e.g., 150% means 1.5x return)

---

### Efficiency Metrics

#### ROAS (Return on Ad Spend)
```
SUM(Revenue) / SUM(Ad_Spend)
```
**Use case**: Marketing efficiency
**Output**: Ratio (e.g., 5.0 means $5 revenue per $1 spent)

#### Operating Ratio
```
Operating_Expenses / Revenue * 100
```
**Use case**: Operational efficiency
**Output**: Percentage (lower is better)

---

### E-commerce Metrics

#### Average Order Value (AOV)
```
SUM(Revenue) / SUM(Orders)
```
**Use case**: Customer spending behavior
**Output**: Currency

#### Conversion Rate %
```
Orders / Visitors * 100
```
or aggregated:
```
SUM(Orders) / SUM(Visitors) * 100
```
**Output**: Percentage

#### Cart Abandonment Rate %
```
(Carts_Created - Orders) / Carts_Created * 100
```
**Output**: Percentage

---

### Marketing Metrics

#### Customer Acquisition Cost (CAC)
```
SUM(Marketing_Spend) / SUM(New_Customers)
```
**Use case**: Cost to acquire one customer
**Output**: Currency

#### Click-Through Rate (CTR)
```
Clicks / Impressions * 100
```
**Output**: Percentage

#### Cost Per Click (CPC)
```
SUM(Ad_Spend) / SUM(Clicks)
```
**Output**: Currency

---

## API Reference

### `calculateFormula()`

```typescript
function calculateFormula(
  data: DataRow[],
  formula: string,
  alias: string,
  options?: {
    aggregateFirst?: boolean  // Calculate aggregations first, return single value
    round?: number            // Decimal places to round to
  }
): CalculationResult
```

**Parameters:**
- `data`: Array of data rows
- `formula`: Formula string (e.g., "(Revenue - Cost) / Revenue * 100")
- `alias`: Name for the calculated column
- `options.aggregateFirst`: If true, aggregates before calculating (for scorecards)
- `options.round`: Number of decimal places (default: no rounding)

**Returns:**
```typescript
{
  data: DataRow[],           // Data with calculated column
  metadata: {
    calculationType: string,
    originalRowCount: number,
    resultRowCount: number,
    columns: string[]
  }
}
```

---

### `validateFormulaComprehensive()`

```typescript
function validateFormulaComprehensive(
  formula: string,
  data: DataRow[],
  options?: {
    requireNumericResult?: boolean
    checkDivisionByZero?: boolean
    maxComplexity?: number
  }
): ValidationResult
```

**Returns:**
```typescript
{
  valid: boolean,
  errors: string[],
  warnings: string[],
  metadata?: {
    usedColumns: string[],
    hasAggregations: boolean,
    aggregationFunctions: string[],
    complexity: number
  }
}
```

---

### `findApplicableFormulas()`

```typescript
function findApplicableFormulas(
  availableColumns: string[]
): FormulaDefinition[]
```

Finds all pre-built formulas that can be calculated with available columns.

---

### `suggestFormulasForData()`

```typescript
function suggestFormulasForData(
  availableColumns: string[]
): Array<{
  formula: FormulaDefinition
  columnMapping: Record<string, string>
  generatedFormula: string
  confidence: 'high' | 'medium' | 'low'
}>
```

Suggests formulas with column mapping and confidence scores.

---

## Pre-built Formula Library

The system includes 25+ pre-built formulas in `common-formulas.ts`:

### Categories
- **Profitability** (5 formulas): Profit Margin, Gross Margin, Net Profit Margin, Markup, etc.
- **Efficiency** (4 formulas): ROAS, ROI, Operating Ratio, Efficiency Ratio
- **E-commerce** (5 formulas): AOV, Conversion Rate, Cart Abandonment, Revenue per Visitor
- **Marketing** (5 formulas): CAC, CTR, CPC, LTV to CAC Ratio
- **Operational** (4 formulas): Inventory Turnover, Days Inventory, Fulfillment Rate
- **Financial** (4 formulas): Current Ratio, Debt to Equity, Quick Ratio, Working Capital

### Using Pre-built Formulas

```typescript
import { COMMON_FORMULAS, suggestFormulasForData } from '@/lib/utils/common-formulas'

// Get all applicable formulas
const suggestions = suggestFormulasForData(['Revenue', 'Cost', 'Orders'])

suggestions.forEach(s => {
  console.log(`${s.formula.name}: ${s.generatedFormula}`)
  console.log(`Confidence: ${s.confidence}`)
})

// Output:
// Profit Margin %: (Revenue - Cost) / Revenue * 100
// Confidence: high
// Average Order Value: SUM(Revenue) / SUM(Orders)
// Confidence: high
```

---

## Security & Safety

### Built-in Protections

1. **Code Injection Prevention**
   - Blocks dangerous characters: `;`, `` ` ``, `$`, `{`, `}`
   - No `eval()` or dynamic code execution
   - Whitelist-only functions

2. **Complexity Limits**
   - Max formula length: 500 characters
   - Max operations: 50
   - Max function depth: 5

3. **Overflow Protection**
   - Rejects `Infinity`, `NaN`, `-Infinity`
   - Max safe value: 1e15
   - Validates all intermediate results

4. **Division by Zero**
   - Automatic detection and prevention
   - Returns `null` for invalid calculations
   - Warnings for columns with zeros

### Example Security Tests

```typescript
// ❌ Rejected: Dangerous characters
parseFormula('Revenue; DROP TABLE users')
// Error: "Formula contains invalid characters"

// ❌ Rejected: Unknown function
parseFormula('EVAL(Revenue)')
// Error: "Unknown function: EVAL"

// ❌ Rejected: Too complex
parseFormula('A+B*C/D-E+F*G/H-I+J*K/L-M+N*O/P-Q+R*S/T...')
// Error: "Formula too complex"

// ✅ Safe: Division by zero handled
calculateFormula([{Revenue: 100, Orders: 0}], 'Revenue / Orders', 'AOV')
// Result: [{ Revenue: 100, Orders: 0, AOV: null }]
```

---

## Performance Optimization

### Row Limits
- General calculations: 10,000 rows
- Sorting operations (median, percentile): 5,000 rows
- Automatically enforced with warnings

### Best Practices

1. **Use aggregateFirst for scorecards**
   ```typescript
   // ✅ Good: Aggregate once
   calculateFormula(data, 'SUM(Revenue) / SUM(Orders)', 'AOV', { aggregateFirst: true })

   // ❌ Avoid: Calculates per row then aggregates
   calculateFormula(data, 'Revenue / Orders', 'AOV', { aggregateFirst: true })
   ```

2. **Round results to avoid precision issues**
   ```typescript
   calculateFormula(data, formula, alias, { round: 2 })
   ```

3. **Pre-filter large datasets**
   ```typescript
   const recentData = data.slice(-1000)
   calculateFormula(recentData, formula, alias)
   ```

---

## Testing

### Run Tests

```bash
npm test -- formula-system.test.ts
```

### Test Coverage

- ✅ Formula parsing (simple, complex, edge cases)
- ✅ Column name matching (exact, fuzzy, case-insensitive)
- ✅ Validation (syntax, columns, division by zero)
- ✅ E-commerce KPIs (Profit Margin, ROAS, AOV, Conversion Rate)
- ✅ Marketing KPIs (CTR, CPC, ROI)
- ✅ Financial KPIs (Gross Margin, Operating Ratio, Net Profit Margin)
- ✅ Edge cases (empty data, nulls, zeros, large numbers)
- ✅ Performance (10,000 row datasets)
- ✅ Integration with chart processors

---

## Troubleshooting

### Common Errors

#### "Column not found"
```
Error: Column not found: "revenue". Available: Revenue, Cost, Orders
```
**Solution**: Use exact column names or wrap in brackets: `[Revenue]`

#### "Division by zero"
```
Error: Division by zero
```
**Solution**: Filter out rows with zero denominators or use validation

#### "Invalid formula"
```
Error: Invalid formula: Unexpected character '@'
```
**Solution**: Remove special characters, use only allowed operators

#### "Formula too complex"
```
Error: Formula too complex (complexity: 65, max: 50)
```
**Solution**: Break into multiple calculated columns

---

## Extending the System

### Adding New Functions

```typescript
// In formula-parser.ts
const ALLOWED_FUNCTIONS = [..., 'MEDIAN', 'PERCENTILE']

// In evaluateFormula()
case 'MEDIAN':
  result = calculateMedian(values)
  break
```

### Adding New Pre-built Formulas

```typescript
// In common-formulas.ts
export const COMMON_FORMULAS = {
  ...existing,

  custom_metric: {
    id: 'custom_metric',
    name: 'Custom Metric',
    category: 'custom',
    description: 'Your description',
    formula: 'A / B * 100',
    requiredColumns: ['A', 'B'],
    outputType: 'percentage',
    interpretation: 'Higher is better'
  }
}
```

---

## Integration with OpenAI

The formula system is fully integrated with the AI analysis endpoint. OpenAI can now:

1. **Detect when formulas are needed**
   ```
   Data has Revenue and Cost columns
   → AI suggests: "(Revenue - Cost) / Revenue * 100" for Profit Margin
   ```

2. **Generate appropriate formulas**
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

3. **Choose between regular aggregation and formulas**
   - Simple metric → Use `aggregation`: `{ metric: "Revenue", aggregation: "sum" }`
   - Calculated metric → Use `formula`: `{ formula: "Revenue / Orders" }`

---

## Summary

The formula calculation system provides:

✅ **Safe**: Security-first design with injection prevention
✅ **Flexible**: Supports 25+ pre-built formulas + custom formulas
✅ **AI-Ready**: Integrated with OpenAI for automatic suggestions
✅ **Type-Safe**: Full TypeScript typing
✅ **Performant**: Optimized for real-world datasets
✅ **Well-Tested**: Comprehensive test coverage

**Files Created/Modified:**
- `/lib/utils/formula-parser.ts` (NEW)
- `/lib/utils/formula-validator.ts` (NEW)
- `/lib/utils/common-formulas.ts` (NEW)
- `/lib/utils/data-calculations.ts` (MODIFIED)
- `/lib/utils/chart-data-processor.ts` (MODIFIED)
- `/app/api/analyze/route.ts` (MODIFIED)

**Ready for production use!**
