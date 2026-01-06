/**
 * Semantic Color Palette System
 *
 * Provides intelligent color assignment based on column semantic types and roles.
 * Colors are designed to be:
 * - Semantically meaningful (green = positive, red = negative, etc.)
 * - Aesthetically harmonious
 * - Accessible (sufficient contrast)
 * - Consistent across the dashboard
 */

import type { SemanticType, ColumnRole, ColumnSchema } from '@/lib/store'

// ============================================================================
// COLOR PALETTE DEFINITIONS
// ============================================================================

/**
 * Semantic color categories with curated sub-palettes
 * Each category has 5 shades for multi-series support
 */
export const SEMANTIC_PALETTES = {
  // Positive/Growth metrics - Greens/Teals
  positive: {
    primary: '#10b981',
    shades: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669'],
    description: 'Revenue, profit, growth, gains'
  },

  // Negative/Decline metrics - Reds/Corals
  negative: {
    primary: '#ef4444',
    shades: ['#ef4444', '#f87171', '#fca5a5', '#dc2626', '#b91c1c'],
    description: 'Costs, losses, churn, decline'
  },

  // Monetary/Financial - Emerald/Gold
  monetary: {
    primary: '#059669',
    shades: ['#059669', '#10b981', '#f59e0b', '#fbbf24', '#047857'],
    description: 'Price, amount, budget, salary'
  },

  // Time/Temporal - Blues
  temporal: {
    primary: '#3b82f6',
    shades: ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#1d4ed8'],
    description: 'Date, month, year, duration'
  },

  // Categorical/Dimensional - Purples/Indigos
  categorical: {
    primary: '#8b5cf6',
    shades: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#7c3aed', '#6d28d9'],
    description: 'Category, type, status, region'
  },

  // Quantity/Count - Ambers/Oranges
  quantity: {
    primary: '#f59e0b',
    shades: ['#f59e0b', '#fbbf24', '#fcd34d', '#d97706', '#b45309'],
    description: 'Count, quantity, units, orders'
  },

  // Percentage/Rate - Cyans
  percentage: {
    primary: '#06b6d4',
    shades: ['#06b6d4', '#22d3ee', '#67e8f9', '#0891b2', '#0e7490'],
    description: 'Percent, rate, ratio, conversion'
  },

  // Score/Rating - Pinks/Rose
  score: {
    primary: '#ec4899',
    shades: ['#ec4899', '#f472b6', '#f9a8d4', '#db2777', '#be185d'],
    description: 'Score, rating, rank, grade'
  },

  // Identifier - Slate/Gray
  identifier: {
    primary: '#64748b',
    shades: ['#64748b', '#94a3b8', '#cbd5e1', '#475569', '#334155'],
    description: 'ID, key, code, reference'
  },

  // Neutral/Default - Slate Blue
  neutral: {
    primary: '#6366f1',
    shades: ['#6366f1', '#818cf8', '#a5b4fc', '#4f46e5', '#4338ca'],
    description: 'Default for undetected types'
  }
} as const

/**
 * Multi-series default palette for charts with many series
 * Harmonious colors that work well together
 */
export const DEFAULT_CHART_PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#ef4444', // Red
  '#84cc16', // Lime
]

// ============================================================================
// SEMANTIC TYPE TO COLOR CATEGORY MAPPING
// ============================================================================

type ColorCategory = keyof typeof SEMANTIC_PALETTES

/**
 * Maps semantic types to color categories
 */
const SEMANTIC_TYPE_TO_CATEGORY: Record<SemanticType, ColorCategory> = {
  // Monetary
  currency: 'monetary',

  // Percentages/Rates
  percentage: 'percentage',
  ratio: 'percentage',

  // Counts/Quantities
  count: 'quantity',

  // Scores
  score: 'score',

  // Identifiers
  id: 'identifier',
  uuid: 'identifier',
  sku: 'identifier',

  // Contact info (treat as categorical)
  email: 'categorical',
  url: 'categorical',
  phone: 'categorical',

  // Names/Labels (categorical)
  name: 'categorical',
  label: 'categorical',

  // Location (categorical)
  address: 'categorical',
  city: 'categorical',
  country: 'categorical',
  zip: 'categorical',

  // Categories
  category: 'categorical',
  status: 'categorical',

  // Time
  duration: 'temporal',
  date: 'temporal',
  datetime: 'temporal',
  time: 'temporal',

  // Default
  generic: 'neutral'
}

/**
 * Maps column roles to color categories (fallback when semantic type is unknown)
 */
const ROLE_TO_CATEGORY: Record<ColumnRole, ColorCategory> = {
  metric: 'quantity',
  dimension: 'categorical',
  timestamp: 'temporal',
  identifier: 'identifier',
  unknown: 'neutral'
}

// ============================================================================
// COLUMN NAME PATTERN DETECTION
// ============================================================================

/**
 * Detect if column name suggests positive/growth semantics
 */
const POSITIVE_PATTERNS = [
  /revenue/i, /income/i, /profit/i, /gain/i, /growth/i,
  /sales/i, /earnings/i, /return/i, /^roi$/i, /roas/i,
  /retention/i, /conversion/i, /success/i, /win/i
]

/**
 * Detect if column name suggests negative/cost semantics
 */
const NEGATIVE_PATTERNS = [
  /cost/i, /expense/i, /loss/i, /spend/i, /churn/i,
  /decline/i, /decrease/i, /refund/i, /discount/i,
  /debt/i, /liability/i, /bounce/i, /fail/i, /error/i
]

/**
 * Check if column name matches positive patterns
 */
function isPositiveColumn(columnName: string): boolean {
  return POSITIVE_PATTERNS.some(pattern => pattern.test(columnName))
}

/**
 * Check if column name matches negative patterns
 */
function isNegativeColumn(columnName: string): boolean {
  return NEGATIVE_PATTERNS.some(pattern => pattern.test(columnName))
}

// ============================================================================
// COLOR ASSIGNMENT SERVICE
// ============================================================================

/**
 * Color assignment cache for consistency across dashboard
 * Maps column names to assigned colors
 */
const colorAssignmentCache = new Map<string, string>()

/**
 * Get the color category for a column based on its metadata
 */
export function getColorCategory(column: ColumnSchema): ColorCategory {
  const columnName = column.name.toLowerCase()

  // First check for positive/negative patterns (highest priority)
  if (isPositiveColumn(columnName)) {
    return 'positive'
  }
  if (isNegativeColumn(columnName)) {
    return 'negative'
  }

  // Then check semantic type
  if (column.semanticType && column.semanticType !== 'generic') {
    return SEMANTIC_TYPE_TO_CATEGORY[column.semanticType]
  }

  // Then check role
  if (column.role && column.role !== 'unknown') {
    return ROLE_TO_CATEGORY[column.role]
  }

  // Default based on data type
  if (column.type === 'number') {
    return 'quantity'
  }
  if (column.type === 'date') {
    return 'temporal'
  }
  if (column.type === 'categorical' || column.type === 'string') {
    return 'categorical'
  }

  return 'neutral'
}

/**
 * Get the primary color for a column
 */
export function getColumnColor(column: ColumnSchema): string {
  // Check cache first
  const cached = colorAssignmentCache.get(column.name)
  if (cached) {
    return cached
  }

  const category = getColorCategory(column)
  const color = SEMANTIC_PALETTES[category].primary

  // Cache for consistency
  colorAssignmentCache.set(column.name, color)

  return color
}

/**
 * Get a full palette for a column (for gradients or multi-shade needs)
 */
export function getColumnPalette(column: ColumnSchema): string[] {
  const category = getColorCategory(column)
  return [...SEMANTIC_PALETTES[category].shades]
}

/**
 * Get colors for multiple columns, ensuring they're visually distinct
 */
export function getColorsForColumns(columns: ColumnSchema[]): string[] {
  const usedColors = new Set<string>()
  const colors: string[] = []

  for (const column of columns) {
    const category = getColorCategory(column)
    const palette = SEMANTIC_PALETTES[category].shades

    // Try to find an unused color from this category
    let assignedColor: string = palette[0]
    for (const color of palette) {
      if (!usedColors.has(color)) {
        assignedColor = color
        break
      }
    }

    // If all colors in category are used, still use the primary
    colors.push(assignedColor)
    usedColors.add(assignedColor)

    // Cache assignment
    colorAssignmentCache.set(column.name, assignedColor)
  }

  return colors
}

/**
 * Get colors for column names (when full ColumnSchema is not available)
 * Uses pattern matching on names
 */
export function getColorsForColumnNames(
  columnNames: string[],
  schema?: ColumnSchema[]
): string[] {
  // If schema is available, use full semantic detection
  if (schema) {
    const schemaMap = new Map(schema.map(col => [col.name, col]))
    const columns = columnNames.map(name =>
      schemaMap.get(name) || { name, type: 'string' as const, uniqueValues: 0, nullCount: 0, nullPercentage: 0, sampleValues: [] }
    )
    return getColorsForColumns(columns)
  }

  // Fallback: use pattern matching on names
  const usedColors = new Set<string>()
  const colors: string[] = []
  let defaultIndex = 0

  for (const name of columnNames) {
    // Check cache
    const cached = colorAssignmentCache.get(name)
    if (cached) {
      colors.push(cached)
      usedColors.add(cached)
      continue
    }

    let color: string

    if (isPositiveColumn(name)) {
      color = SEMANTIC_PALETTES.positive.primary
    } else if (isNegativeColumn(name)) {
      color = SEMANTIC_PALETTES.negative.primary
    } else if (/date|time|month|year|day|week|quarter/i.test(name)) {
      color = SEMANTIC_PALETTES.temporal.primary
    } else if (/price|cost|amount|revenue|total|fee|salary|budget/i.test(name)) {
      color = SEMANTIC_PALETTES.monetary.primary
    } else if (/count|qty|quantity|num|number|total/i.test(name)) {
      color = SEMANTIC_PALETTES.quantity.primary
    } else if (/percent|pct|rate|ratio/i.test(name)) {
      color = SEMANTIC_PALETTES.percentage.primary
    } else if (/score|rating|rank/i.test(name)) {
      color = SEMANTIC_PALETTES.score.primary
    } else if (/id$|_id|key|code|sku|uuid/i.test(name)) {
      color = SEMANTIC_PALETTES.identifier.primary
    } else if (/category|type|status|region|country|city/i.test(name)) {
      color = SEMANTIC_PALETTES.categorical.primary
    } else {
      // Use default palette for unknowns, cycling through
      color = DEFAULT_CHART_PALETTE[defaultIndex % DEFAULT_CHART_PALETTE.length]
      defaultIndex++
    }

    // If color already used, try to get a shade
    if (usedColors.has(color)) {
      const category = Object.entries(SEMANTIC_PALETTES).find(
        ([_, palette]) => palette.primary === color
      )
      if (category) {
        const shades = category[1].shades
        for (const shade of shades) {
          if (!usedColors.has(shade)) {
            color = shade
            break
          }
        }
      }
    }

    colors.push(color)
    usedColors.add(color)
    colorAssignmentCache.set(name, color)
  }

  return colors
}

/**
 * Clear the color assignment cache
 * Call this when loading a new dataset
 */
export function clearColorCache(): void {
  colorAssignmentCache.clear()
}

/**
 * Get a color for a specific value (useful for pie charts, categorical data)
 * Ensures same value always gets same color
 */
const valueColorCache = new Map<string, string>()

export function getColorForValue(value: string, index: number = 0): string {
  const cached = valueColorCache.get(value)
  if (cached) {
    return cached
  }

  // Use hash of value to pick consistent color
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash = hash & hash
  }

  const color = DEFAULT_CHART_PALETTE[Math.abs(hash) % DEFAULT_CHART_PALETTE.length]
  valueColorCache.set(value, color)

  return color
}

/**
 * Clear value color cache
 */
export function clearValueColorCache(): void {
  valueColorCache.clear()
}

// ============================================================================
// GRADIENT UTILITIES
// ============================================================================

/**
 * Generate a gradient definition for SVG charts
 */
export function getGradientDef(
  id: string,
  color: string,
  direction: 'vertical' | 'horizontal' = 'vertical'
): { id: string; startColor: string; endColor: string; x1: string; y1: string; x2: string; y2: string } {
  return {
    id,
    startColor: color,
    endColor: `${color}40`, // 25% opacity
    x1: '0%',
    y1: direction === 'vertical' ? '0%' : '0%',
    x2: direction === 'vertical' ? '0%' : '100%',
    y2: direction === 'vertical' ? '100%' : '0%'
  }
}

/**
 * Lighten a hex color
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.min(255, (num >> 16) + amt)
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt)
  const B = Math.min(255, (num & 0x0000FF) + amt)
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
}

/**
 * Darken a hex color
 */
export function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.max(0, (num >> 16) - amt)
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt)
  const B = Math.max(0, (num & 0x0000FF) - amt)
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
}

/**
 * Add alpha/transparency to a hex color
 */
export function withAlpha(hex: string, alpha: number): string {
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${alphaHex}`
}
