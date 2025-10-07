/**
 * Common Formula Library
 *
 * Pre-built formulas for common e-commerce, financial, and operational KPIs.
 * These formulas can be used directly or serve as templates for custom calculations.
 */

// ============================================================================
// Types
// ============================================================================

export interface FormulaDefinition {
  id: string
  name: string
  category: 'profitability' | 'efficiency' | 'ecommerce' | 'marketing' | 'operational' | 'financial'
  description: string
  formula: string
  requiredColumns: string[]
  exampleColumns?: Record<string, string> // Maps required columns to example column names
  outputType: 'percentage' | 'ratio' | 'currency' | 'number'
  interpretation: string // How to interpret the result
}

// ============================================================================
// Formula Definitions
// ============================================================================

export const COMMON_FORMULAS: Record<string, FormulaDefinition> = {
  // ========================================
  // Profitability Metrics
  // ========================================

  profit_margin: {
    id: 'profit_margin',
    name: 'Profit Margin %',
    category: 'profitability',
    description: 'Percentage of revenue that becomes profit',
    formula: '(Revenue - Cost) / Revenue * 100',
    requiredColumns: ['Revenue', 'Cost'],
    exampleColumns: {
      Revenue: 'Total_Sales',
      Cost: 'Total_Cost'
    },
    outputType: 'percentage',
    interpretation: 'Higher is better. Shows how much profit is made per dollar of revenue.'
  },

  gross_margin: {
    id: 'gross_margin',
    name: 'Gross Margin %',
    category: 'profitability',
    description: 'Revenue minus cost of goods sold, as percentage of revenue',
    formula: '(Revenue - COGS) / Revenue * 100',
    requiredColumns: ['Revenue', 'COGS'],
    exampleColumns: {
      Revenue: 'Total_Revenue',
      COGS: 'Cost_of_Goods_Sold'
    },
    outputType: 'percentage',
    interpretation: 'Higher is better. Measures production efficiency.'
  },

  net_profit_margin: {
    id: 'net_profit_margin',
    name: 'Net Profit Margin %',
    category: 'profitability',
    description: 'Net profit as percentage of revenue after all expenses',
    formula: '(Revenue - Total_Expenses) / Revenue * 100',
    requiredColumns: ['Revenue', 'Total_Expenses'],
    outputType: 'percentage',
    interpretation: 'Higher is better. Shows overall profitability after all costs.'
  },

  markup: {
    id: 'markup',
    name: 'Markup %',
    category: 'profitability',
    description: 'Percentage added to cost to determine price',
    formula: '(Price - Cost) / Cost * 100',
    requiredColumns: ['Price', 'Cost'],
    outputType: 'percentage',
    interpretation: 'How much you mark up products above cost.'
  },

  // ========================================
  // Efficiency & ROI Metrics
  // ========================================

  roas: {
    id: 'roas',
    name: 'Return on Ad Spend (ROAS)',
    category: 'efficiency',
    description: 'Revenue generated per dollar spent on advertising',
    formula: 'Revenue / Ad_Spend',
    requiredColumns: ['Revenue', 'Ad_Spend'],
    exampleColumns: {
      Revenue: 'Total_Revenue',
      Ad_Spend: 'Marketing_Spend'
    },
    outputType: 'ratio',
    interpretation: 'Higher is better. A ROAS of 4 means $4 revenue per $1 ad spend.'
  },

  roi: {
    id: 'roi',
    name: 'Return on Investment %',
    category: 'efficiency',
    description: 'Return on investment as percentage',
    formula: '(Revenue - Cost) / Cost * 100',
    requiredColumns: ['Revenue', 'Cost'],
    outputType: 'percentage',
    interpretation: 'Higher is better. Shows percentage return on investment.'
  },

  operating_ratio: {
    id: 'operating_ratio',
    name: 'Operating Ratio',
    category: 'efficiency',
    description: 'Operating expenses as percentage of revenue',
    formula: 'Operating_Expenses / Revenue * 100',
    requiredColumns: ['Operating_Expenses', 'Revenue'],
    outputType: 'percentage',
    interpretation: 'Lower is better. Shows efficiency of operations.'
  },

  efficiency_ratio: {
    id: 'efficiency_ratio',
    name: 'Efficiency Ratio',
    category: 'efficiency',
    description: 'Ratio of expenses to revenue',
    formula: 'Total_Expenses / Revenue',
    requiredColumns: ['Total_Expenses', 'Revenue'],
    outputType: 'ratio',
    interpretation: 'Lower is better. Values below 1 indicate profitability.'
  },

  // ========================================
  // E-commerce Metrics
  // ========================================

  aov: {
    id: 'aov',
    name: 'Average Order Value',
    category: 'ecommerce',
    description: 'Average value per order',
    formula: 'SUM(Revenue) / SUM(Orders)',
    requiredColumns: ['Revenue', 'Orders'],
    exampleColumns: {
      Revenue: 'Total_Sales',
      Orders: 'Order_Count'
    },
    outputType: 'currency',
    interpretation: 'Higher is better. Average amount customers spend per order.'
  },

  conversion_rate: {
    id: 'conversion_rate',
    name: 'Conversion Rate %',
    category: 'ecommerce',
    description: 'Percentage of visitors who make a purchase',
    formula: 'Orders / Visitors * 100',
    requiredColumns: ['Orders', 'Visitors'],
    exampleColumns: {
      Orders: 'Total_Orders',
      Visitors: 'Site_Visitors'
    },
    outputType: 'percentage',
    interpretation: 'Higher is better. Shows effectiveness at converting visitors to customers.'
  },

  cart_abandonment_rate: {
    id: 'cart_abandonment_rate',
    name: 'Cart Abandonment Rate %',
    category: 'ecommerce',
    description: 'Percentage of carts that are abandoned',
    formula: '(Carts_Created - Orders) / Carts_Created * 100',
    requiredColumns: ['Carts_Created', 'Orders'],
    outputType: 'percentage',
    interpretation: 'Lower is better. Shows how many customers abandon their carts.'
  },

  revenue_per_visitor: {
    id: 'revenue_per_visitor',
    name: 'Revenue per Visitor',
    category: 'ecommerce',
    description: 'Average revenue generated per site visitor',
    formula: 'SUM(Revenue) / SUM(Visitors)',
    requiredColumns: ['Revenue', 'Visitors'],
    outputType: 'currency',
    interpretation: 'Higher is better. Combines traffic and monetization effectiveness.'
  },

  items_per_order: {
    id: 'items_per_order',
    name: 'Items per Order',
    category: 'ecommerce',
    description: 'Average number of items per order',
    formula: 'SUM(Items) / SUM(Orders)',
    requiredColumns: ['Items', 'Orders'],
    outputType: 'number',
    interpretation: 'Shows shopping basket size. Higher values may indicate cross-selling success.'
  },

  // ========================================
  // Marketing Metrics
  // ========================================

  cac: {
    id: 'cac',
    name: 'Customer Acquisition Cost',
    category: 'marketing',
    description: 'Cost to acquire one new customer',
    formula: 'Marketing_Spend / New_Customers',
    requiredColumns: ['Marketing_Spend', 'New_Customers'],
    exampleColumns: {
      Marketing_Spend: 'Total_Marketing_Budget',
      New_Customers: 'Customers_Acquired'
    },
    outputType: 'currency',
    interpretation: 'Lower is better. Should be less than customer lifetime value.'
  },

  cac_aggregate: {
    id: 'cac_aggregate',
    name: 'Customer Acquisition Cost (Aggregated)',
    category: 'marketing',
    description: 'Total cost to acquire customers across all data',
    formula: 'SUM(Marketing_Spend) / SUM(New_Customers)',
    requiredColumns: ['Marketing_Spend', 'New_Customers'],
    outputType: 'currency',
    interpretation: 'Lower is better. Average CAC across entire period.'
  },

  ctr: {
    id: 'ctr',
    name: 'Click-Through Rate %',
    category: 'marketing',
    description: 'Percentage of impressions that result in clicks',
    formula: 'Clicks / Impressions * 100',
    requiredColumns: ['Clicks', 'Impressions'],
    outputType: 'percentage',
    interpretation: 'Higher is better. Shows ad relevance and appeal.'
  },

  cpc: {
    id: 'cpc',
    name: 'Cost Per Click',
    category: 'marketing',
    description: 'Average cost for each click',
    formula: 'SUM(Ad_Spend) / SUM(Clicks)',
    requiredColumns: ['Ad_Spend', 'Clicks'],
    outputType: 'currency',
    interpretation: 'Lower is better (for same quality traffic). Indicates ad auction competitiveness.'
  },

  ltv_to_cac: {
    id: 'ltv_to_cac',
    name: 'LTV to CAC Ratio',
    category: 'marketing',
    description: 'Customer lifetime value divided by acquisition cost',
    formula: 'Customer_LTV / CAC',
    requiredColumns: ['Customer_LTV', 'CAC'],
    outputType: 'ratio',
    interpretation: 'Higher is better. Should be at least 3:1 for healthy business.'
  },

  // ========================================
  // Operational Metrics
  // ========================================

  inventory_turnover: {
    id: 'inventory_turnover',
    name: 'Inventory Turnover',
    category: 'operational',
    description: 'How many times inventory is sold and replaced',
    formula: 'COGS / Average_Inventory',
    requiredColumns: ['COGS', 'Average_Inventory'],
    outputType: 'ratio',
    interpretation: 'Higher is better. Shows inventory management efficiency.'
  },

  days_inventory: {
    id: 'days_inventory',
    name: 'Days Inventory Outstanding',
    category: 'operational',
    description: 'Average days to sell inventory',
    formula: '365 / (COGS / Average_Inventory)',
    requiredColumns: ['COGS', 'Average_Inventory'],
    outputType: 'number',
    interpretation: 'Lower is better. Shows how quickly inventory moves.'
  },

  fulfillment_rate: {
    id: 'fulfillment_rate',
    name: 'Order Fulfillment Rate %',
    category: 'operational',
    description: 'Percentage of orders successfully fulfilled',
    formula: 'Orders_Fulfilled / Total_Orders * 100',
    requiredColumns: ['Orders_Fulfilled', 'Total_Orders'],
    outputType: 'percentage',
    interpretation: 'Higher is better. Should be as close to 100% as possible.'
  },

  return_rate: {
    id: 'return_rate',
    name: 'Return Rate %',
    category: 'operational',
    description: 'Percentage of orders that are returned',
    formula: 'Returns / Orders * 100',
    requiredColumns: ['Returns', 'Orders'],
    outputType: 'percentage',
    interpretation: 'Lower is better. High rates may indicate product or quality issues.'
  },

  // ========================================
  // Financial Metrics
  // ========================================

  current_ratio: {
    id: 'current_ratio',
    name: 'Current Ratio',
    category: 'financial',
    description: 'Current assets divided by current liabilities',
    formula: 'Current_Assets / Current_Liabilities',
    requiredColumns: ['Current_Assets', 'Current_Liabilities'],
    outputType: 'ratio',
    interpretation: 'Higher is better. Above 1.0 indicates good short-term financial health.'
  },

  debt_to_equity: {
    id: 'debt_to_equity',
    name: 'Debt to Equity Ratio',
    category: 'financial',
    description: 'Total debt divided by total equity',
    formula: 'Total_Debt / Total_Equity',
    requiredColumns: ['Total_Debt', 'Total_Equity'],
    outputType: 'ratio',
    interpretation: 'Lower is better. Shows financial leverage and risk.'
  },

  quick_ratio: {
    id: 'quick_ratio',
    name: 'Quick Ratio (Acid Test)',
    category: 'financial',
    description: 'Liquid assets divided by current liabilities',
    formula: '(Current_Assets - Inventory) / Current_Liabilities',
    requiredColumns: ['Current_Assets', 'Inventory', 'Current_Liabilities'],
    outputType: 'ratio',
    interpretation: 'Higher is better. Above 1.0 indicates ability to pay short-term obligations.'
  },

  working_capital: {
    id: 'working_capital',
    name: 'Working Capital',
    category: 'financial',
    description: 'Current assets minus current liabilities',
    formula: 'Current_Assets - Current_Liabilities',
    requiredColumns: ['Current_Assets', 'Current_Liabilities'],
    outputType: 'currency',
    interpretation: 'Positive is better. Shows available capital for operations.'
  }
}

// ============================================================================
// Formula Matching & Suggestions
// ============================================================================

/**
 * Find formulas that can be calculated with available columns
 */
export function findApplicableFormulas(availableColumns: string[]): FormulaDefinition[] {
  const applicable: FormulaDefinition[] = []

  // Normalize available columns for fuzzy matching
  const normalizedColumns = availableColumns.map(col => col.toLowerCase().replace(/[_\s-]/g, ''))

  for (const formula of Object.values(COMMON_FORMULAS)) {
    // Check if all required columns are available (with fuzzy matching)
    const hasAllColumns = formula.requiredColumns.every(required => {
      const normalizedRequired = required.toLowerCase().replace(/[_\s-]/g, '')

      // Exact match
      if (availableColumns.includes(required)) return true

      // Fuzzy match
      return normalizedColumns.some(col => col.includes(normalizedRequired) || normalizedRequired.includes(col))
    })

    if (hasAllColumns) {
      applicable.push(formula)
    }
  }

  return applicable
}

/**
 * Get formulas by category
 */
export function getFormulasByCategory(category: FormulaDefinition['category']): FormulaDefinition[] {
  return Object.values(COMMON_FORMULAS).filter(f => f.category === category)
}

/**
 * Find formula by ID
 */
export function getFormulaById(id: string): FormulaDefinition | undefined {
  return COMMON_FORMULAS[id]
}

/**
 * Map required columns to actual columns in dataset
 */
export function mapFormulaColumns(
  formula: FormulaDefinition,
  availableColumns: string[]
): Record<string, string> | null {
  const mapping: Record<string, string> = {}

  for (const required of formula.requiredColumns) {
    const normalizedRequired = required.toLowerCase().replace(/[_\s-]/g, '')

    // Try exact match first
    if (availableColumns.includes(required)) {
      mapping[required] = required
      continue
    }

    // Try case-insensitive match
    const caseMatch = availableColumns.find(col => col.toLowerCase() === required.toLowerCase())
    if (caseMatch) {
      mapping[required] = caseMatch
      continue
    }

    // Try fuzzy match
    const fuzzyMatch = availableColumns.find(col => {
      const normalizedCol = col.toLowerCase().replace(/[_\s-]/g, '')
      return normalizedCol.includes(normalizedRequired) || normalizedRequired.includes(normalizedCol)
    })

    if (fuzzyMatch) {
      mapping[required] = fuzzyMatch
      continue
    }

    // No match found for this required column
    return null
  }

  return mapping
}

/**
 * Generate formula string with actual column names
 */
export function generateFormulaWithColumns(
  formula: FormulaDefinition,
  columnMapping: Record<string, string>
): string {
  let generatedFormula = formula.formula

  // Replace each required column with its mapped actual column
  for (const [required, actual] of Object.entries(columnMapping)) {
    // Use word boundaries to avoid partial replacements
    const regex = new RegExp(`\\b${required}\\b`, 'g')

    // If actual column has spaces or special chars, wrap in brackets
    const replacement = /[\s-]/.test(actual) ? `[${actual}]` : actual

    generatedFormula = generatedFormula.replace(regex, replacement)
  }

  return generatedFormula
}

/**
 * Suggest formulas based on column names and patterns
 */
export function suggestFormulasForData(availableColumns: string[]): Array<{
  formula: FormulaDefinition
  columnMapping: Record<string, string>
  generatedFormula: string
  confidence: 'high' | 'medium' | 'low'
}> {
  const suggestions: Array<{
    formula: FormulaDefinition
    columnMapping: Record<string, string>
    generatedFormula: string
    confidence: 'high' | 'medium' | 'low'
  }> = []

  const applicable = findApplicableFormulas(availableColumns)

  for (const formula of applicable) {
    const mapping = mapFormulaColumns(formula, availableColumns)
    if (!mapping) continue

    const generatedFormula = generateFormulaWithColumns(formula, mapping)

    // Determine confidence based on column name similarity
    let exactMatches = 0
    let fuzzyMatches = 0

    for (const [required, actual] of Object.entries(mapping)) {
      if (required === actual) {
        exactMatches++
      } else if (required.toLowerCase() === actual.toLowerCase()) {
        exactMatches++
      } else {
        fuzzyMatches++
      }
    }

    const confidence =
      exactMatches === formula.requiredColumns.length
        ? 'high'
        : exactMatches > fuzzyMatches
        ? 'medium'
        : 'low'

    suggestions.push({
      formula,
      columnMapping: mapping,
      generatedFormula,
      confidence
    })
  }

  // Sort by confidence (high -> medium -> low)
  const confidenceOrder = { high: 0, medium: 1, low: 2 }
  suggestions.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence])

  return suggestions
}

/**
 * Get all formula categories
 */
export function getAllCategories(): Array<{ id: string; name: string; count: number }> {
  const categories = new Map<string, number>()

  for (const formula of Object.values(COMMON_FORMULAS)) {
    categories.set(formula.category, (categories.get(formula.category) || 0) + 1)
  }

  return Array.from(categories.entries()).map(([id, count]) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    count
  }))
}
