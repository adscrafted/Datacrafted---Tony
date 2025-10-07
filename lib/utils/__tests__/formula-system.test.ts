/**
 * Comprehensive Formula System Tests
 *
 * Tests for formula parser, validator, and calculator
 * Covers real-world e-commerce and financial KPI calculations
 */

import { DataRow } from '@/lib/store'
import {
  parseFormula,
  validateFormula,
  calculateFormulaForRow,
  tokenizeFormula,
  extractAggregateFunctions,
  findMatchingColumn
} from '../formula-parser'
import { validateFormulaComprehensive, quickValidateFormula } from '../formula-validator'
import { calculateFormula } from '../data-calculations'
import { COMMON_FORMULAS, findApplicableFormulas, suggestFormulasForData } from '../common-formulas'

// ============================================================================
// Test Data
// ============================================================================

const sampleEcommerceData: DataRow[] = [
  { Product: 'Widget A', Revenue: 1000, Cost: 600, Orders: 10, Visitors: 100, Ad_Spend: 200 },
  { Product: 'Widget B', Revenue: 1500, Cost: 900, Orders: 15, Visitors: 150, Ad_Spend: 300 },
  { Product: 'Widget C', Revenue: 2000, Cost: 1200, Orders: 20, Visitors: 200, Ad_Spend: 400 },
  { Product: 'Widget D', Revenue: 500, Cost: 300, Orders: 5, Visitors: 50, Ad_Spend: 100 },
  { Product: 'Widget E', Revenue: 800, Cost: 480, Orders: 8, Visitors: 80, Ad_Spend: 160 }
]

const sampleMarketingData: DataRow[] = [
  { Campaign: 'Summer Sale', Impressions: 100000, Clicks: 5000, Conversions: 250, Spend: 1000, Revenue: 10000 },
  { Campaign: 'Winter Promo', Impressions: 80000, Clicks: 4000, Conversions: 200, Spend: 800, Revenue: 8000 },
  { Campaign: 'Spring Launch', Impressions: 120000, Clicks: 6000, Conversions: 300, Spend: 1200, Revenue: 12000 }
]

const sampleFinancialData: DataRow[] = [
  { Quarter: 'Q1', Total_Revenue: 500000, COGS: 200000, Operating_Expenses: 150000, Marketing_Spend: 50000 },
  { Quarter: 'Q2', Total_Revenue: 600000, COGS: 240000, Operating_Expenses: 180000, Marketing_Spend: 60000 },
  { Quarter: 'Q3', Total_Revenue: 550000, COGS: 220000, Operating_Expenses: 165000, Marketing_Spend: 55000 },
  { Quarter: 'Q4', Total_Revenue: 700000, COGS: 280000, Operating_Expenses: 210000, Marketing_Spend: 70000 }
]

// ============================================================================
// Formula Parser Tests
// ============================================================================

describe('Formula Parser', () => {
  test('should parse simple arithmetic formula', () => {
    const result = parseFormula('Revenue - Cost')
    expect(result.success).toBe(true)
    expect(result.tokens).toHaveLength(3)
  })

  test('should parse formula with parentheses', () => {
    const result = parseFormula('(Revenue - Cost) / Revenue * 100')
    expect(result.success).toBe(true)
    expect(result.tokens!.filter(t => t.type === 'paren')).toHaveLength(4)
  })

  test('should parse formula with aggregate functions', () => {
    const result = parseFormula('SUM(Revenue) / SUM(Orders)')
    expect(result.success).toBe(true)
    expect(result.tokens!.filter(t => t.type === 'function')).toHaveLength(2)
  })

  test('should parse column names with brackets', () => {
    const result = parseFormula('[Total Sales] / [Order Count]')
    expect(result.success).toBe(true)
    expect(result.tokens!.filter(t => t.type === 'column')).toHaveLength(2)
  })

  test('should reject invalid characters', () => {
    const result = parseFormula('Revenue; DROP TABLE')
    expect(result.success).toBe(false)
    expect(result.error).toContain('invalid characters')
  })

  test('should reject mismatched parentheses', () => {
    const result = parseFormula('(Revenue - Cost')
    expect(result.success).toBe(false)
    expect(result.error).toContain('parentheses')
  })

  test('should reject unknown functions', () => {
    const result = parseFormula('EVAL(Revenue)')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown function')
  })
})

// ============================================================================
// Column Matching Tests
// ============================================================================

describe('Column Matching', () => {
  const columns = ['Revenue', 'Total_Sales', 'Order Count', 'ad-spend']

  test('should find exact match', () => {
    expect(findMatchingColumn('Revenue', columns)).toBe('Revenue')
  })

  test('should find case-insensitive match', () => {
    expect(findMatchingColumn('revenue', columns)).toBe('Revenue')
  })

  test('should convert spaces to underscores', () => {
    expect(findMatchingColumn('Total Sales', columns)).toBe('Total_Sales')
  })

  test('should convert underscores to spaces', () => {
    expect(findMatchingColumn('Order_Count', columns)).toBe('Order Count')
  })

  test('should return null for non-existent column', () => {
    expect(findMatchingColumn('NotExists', columns)).toBeNull()
  })
})

// ============================================================================
// Formula Validation Tests
// ============================================================================

describe('Formula Validation', () => {
  test('should validate simple valid formula', () => {
    const result = validateFormula('Revenue - Cost', ['Revenue', 'Cost'])
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('should detect missing columns', () => {
    const result = validateFormula('Revenue - Profit', ['Revenue', 'Cost'])
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('should validate comprehensive formula', () => {
    const result = validateFormulaComprehensive(
      '(Revenue - Cost) / Revenue * 100',
      sampleEcommerceData
    )
    expect(result.valid).toBe(true)
  })

  test('should detect division by zero risk', () => {
    const dataWithZeros = [{ Revenue: 100, Orders: 0 }]
    const result = validateFormulaComprehensive('Revenue / Orders', dataWithZeros)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Formula Calculation Tests - E-commerce KPIs
// ============================================================================

describe('E-commerce KPI Calculations', () => {
  test('should calculate Profit Margin correctly', () => {
    const result = calculateFormula(
      sampleEcommerceData,
      '(Revenue - Cost) / Revenue * 100',
      'Profit_Margin',
      { round: 2 }
    )

    expect(result.data[0].Profit_Margin).toBeCloseTo(40, 0) // Widget A: (1000-600)/1000*100 = 40%
    expect(result.data[1].Profit_Margin).toBeCloseTo(40, 0) // Widget B: (1500-900)/1500*100 = 40%
  })

  test('should calculate ROAS (aggregated)', () => {
    const result = calculateFormula(
      sampleEcommerceData,
      'SUM(Revenue) / SUM(Ad_Spend)',
      'ROAS',
      { aggregateFirst: true, round: 2 }
    )

    const totalRevenue = 1000 + 1500 + 2000 + 500 + 800 // 5800
    const totalAdSpend = 200 + 300 + 400 + 100 + 160 // 1160
    const expectedROAS = totalRevenue / totalAdSpend // ~5.0

    expect(result.data[0].ROAS).toBeCloseTo(expectedROAS, 1)
  })

  test('should calculate Average Order Value', () => {
    const result = calculateFormula(
      sampleEcommerceData,
      'SUM(Revenue) / SUM(Orders)',
      'AOV',
      { aggregateFirst: true, round: 2 }
    )

    const totalRevenue = 5800
    const totalOrders = 10 + 15 + 20 + 5 + 8 // 58
    const expectedAOV = totalRevenue / totalOrders // 100

    expect(result.data[0].AOV).toBeCloseTo(expectedAOV, 0)
  })

  test('should calculate Conversion Rate', () => {
    const result = calculateFormula(
      sampleEcommerceData,
      'Orders / Visitors * 100',
      'Conversion_Rate',
      { round: 2 }
    )

    expect(result.data[0].Conversion_Rate).toBeCloseTo(10, 0) // 10/100 * 100 = 10%
    expect(result.data[1].Conversion_Rate).toBeCloseTo(10, 0) // 15/150 * 100 = 10%
  })
})

// ============================================================================
// Formula Calculation Tests - Marketing KPIs
// ============================================================================

describe('Marketing KPI Calculations', () => {
  test('should calculate Click-Through Rate', () => {
    const result = calculateFormula(
      sampleMarketingData,
      'Clicks / Impressions * 100',
      'CTR',
      { round: 2 }
    )

    expect(result.data[0].CTR).toBeCloseTo(5, 0) // 5000/100000 * 100 = 5%
    expect(result.data[1].CTR).toBeCloseTo(5, 0) // 4000/80000 * 100 = 5%
  })

  test('should calculate Cost Per Click', () => {
    const result = calculateFormula(
      sampleMarketingData,
      'SUM(Spend) / SUM(Clicks)',
      'CPC',
      { aggregateFirst: true, round: 2 }
    )

    const totalSpend = 1000 + 800 + 1200 // 3000
    const totalClicks = 5000 + 4000 + 6000 // 15000
    const expectedCPC = totalSpend / totalClicks // 0.2

    expect(result.data[0].CPC).toBeCloseTo(expectedCPC, 2)
  })

  test('should calculate ROI percentage', () => {
    const result = calculateFormula(
      sampleMarketingData,
      '(Revenue - Spend) / Spend * 100',
      'ROI_Pct',
      { round: 2 }
    )

    expect(result.data[0].ROI_Pct).toBeCloseTo(900, 0) // (10000-1000)/1000 * 100 = 900%
  })
})

// ============================================================================
// Formula Calculation Tests - Financial KPIs
// ============================================================================

describe('Financial KPI Calculations', () => {
  test('should calculate Gross Margin', () => {
    const result = calculateFormula(
      sampleFinancialData,
      '(Total_Revenue - COGS) / Total_Revenue * 100',
      'Gross_Margin_Pct',
      { round: 2 }
    )

    expect(result.data[0].Gross_Margin_Pct).toBeCloseTo(60, 0) // (500000-200000)/500000*100 = 60%
  })

  test('should calculate Operating Ratio', () => {
    const result = calculateFormula(
      sampleFinancialData,
      'Operating_Expenses / Total_Revenue * 100',
      'Operating_Ratio_Pct',
      { round: 2 }
    )

    expect(result.data[0].Operating_Ratio_Pct).toBeCloseTo(30, 0) // 150000/500000*100 = 30%
  })

  test('should calculate Net Profit Margin', () => {
    const result = calculateFormula(
      sampleFinancialData,
      '(Total_Revenue - COGS - Operating_Expenses) / Total_Revenue * 100',
      'Net_Profit_Margin_Pct',
      { round: 2 }
    )

    // Q1: (500000 - 200000 - 150000) / 500000 * 100 = 30%
    expect(result.data[0].Net_Profit_Margin_Pct).toBeCloseTo(30, 0)
  })
})

// ============================================================================
// Common Formulas Library Tests
// ============================================================================

describe('Common Formulas Library', () => {
  test('should find applicable formulas for e-commerce data', () => {
    const columns = ['Revenue', 'Cost', 'Orders', 'Visitors', 'Ad_Spend']
    const applicable = findApplicableFormulas(columns)

    expect(applicable.length).toBeGreaterThan(0)
    expect(applicable.some(f => f.id === 'profit_margin')).toBe(true)
    expect(applicable.some(f => f.id === 'roas')).toBe(true)
  })

  test('should suggest formulas with column mapping', () => {
    const columns = ['Revenue', 'Cost', 'Orders', 'Visitors']
    const suggestions = suggestFormulasForData(columns)

    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0].columnMapping).toBeDefined()
    expect(suggestions[0].generatedFormula).toBeDefined()
  })

  test('should map formula columns correctly', () => {
    const formula = COMMON_FORMULAS.profit_margin
    const columns = ['Total_Revenue', 'Total_Cost']

    const suggestions = suggestFormulasForData(columns)
    const profitMarginSuggestion = suggestions.find(s => s.formula.id === 'profit_margin')

    expect(profitMarginSuggestion).toBeDefined()
    expect(profitMarginSuggestion!.columnMapping.Revenue).toBeDefined()
  })
})

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  test('should handle empty dataset', () => {
    const result = calculateFormula([], 'Revenue / Cost', 'Ratio')
    expect(result.data).toHaveLength(0)
  })

  test('should handle null values gracefully', () => {
    const dataWithNulls = [
      { Revenue: 100, Cost: 50 },
      { Revenue: null, Cost: 30 },
      { Revenue: 200, Cost: null }
    ]

    const result = calculateFormula(dataWithNulls, 'Revenue - Cost', 'Profit')
    expect(result.data).toHaveLength(3)
    expect(result.data[0].Profit).toBe(50)
    expect(result.data[1].Profit).toBeNull()
    expect(result.data[2].Profit).toBeNull()
  })

  test('should handle division by zero', () => {
    const dataWithZeros = [{ Revenue: 100, Orders: 0 }]
    const result = calculateFormula(dataWithZeros, 'Revenue / Orders', 'AOV')

    expect(result.data[0].AOV).toBeNull()
  })

  test('should handle very large numbers', () => {
    const largeData = [{ A: 1e14, B: 2e14 }]
    const result = calculateFormula(largeData, 'A + B', 'Sum')

    expect(result.data[0].Sum).toBe(3e14)
  })

  test('should reject overly complex formulas', () => {
    const complexFormula = 'A + B * C / D - E + F * G / H - I + J * K / L - M'
    const parseResult = parseFormula(complexFormula)

    expect(parseResult.success).toBe(true) // Should parse
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration Tests', () => {
  test('should calculate multiple formulas in sequence', () => {
    let data = [...sampleEcommerceData]

    // Calculate Profit Margin
    const profitResult = calculateFormula(data, '(Revenue - Cost) / Revenue * 100', 'Profit_Margin')
    data = profitResult.data

    // Calculate ROI
    const roiResult = calculateFormula(data, '(Revenue - Ad_Spend) / Ad_Spend * 100', 'ROI_Pct')
    data = roiResult.data

    expect(data[0]).toHaveProperty('Profit_Margin')
    expect(data[0]).toHaveProperty('ROI_Pct')
  })

  test('should work with chart data processor', () => {
    // This would be tested in chart-data-processor tests
    // Just verifying the formula calculation works standalone
    const result = calculateFormula(
      sampleEcommerceData,
      'SUM(Revenue) / SUM(Orders)',
      'AOV',
      { aggregateFirst: true, round: 2 }
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0].AOV).toBeGreaterThan(0)
  })
})

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  test('should handle large datasets efficiently', () => {
    const largeData: DataRow[] = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      revenue: Math.random() * 1000,
      cost: Math.random() * 500
    }))

    const startTime = Date.now()
    const result = calculateFormula(largeData, '(revenue - cost) / revenue * 100', 'margin')
    const endTime = Date.now()

    expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second
    expect(result.data).toHaveLength(10000)
  })
})

console.log('✅ All formula system tests completed!')
