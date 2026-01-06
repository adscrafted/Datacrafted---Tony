import { DEFAULT_CHART_PALETTE } from '@/lib/utils/semantic-colors'

// Enhanced chart minimum dimensions and aspect ratios for better content visibility
export const CHART_MINIMUMS = {
  bar: { width: 300, height: 250, aspectRatio: 4/3 },
  line: { width: 350, height: 250, aspectRatio: 5/3 },
  pie: { width: 280, height: 280, aspectRatio: 1 },
  area: { width: 350, height: 250, aspectRatio: 5/3 },
  scatter: { width: 350, height: 250, aspectRatio: 5/3 },
  scorecard: { width: 200, height: 120, aspectRatio: 3/2 },
  table: { width: 400, height: 300, aspectRatio: 3/2 },
  combo: { width: 400, height: 300, aspectRatio: 4/3 }
} as const

// Enhanced responsive breakpoints for better legend and label visibility
export const RESPONSIVE_BREAKPOINTS = {
  large: 500,   // Reduced threshold for showing all features
  medium: 350,  // Reduced threshold for showing core features
  small: 250    // Minimum for basic functionality
} as const

// Default color palette for charts - uses semantic color system
export const COLORS = DEFAULT_CHART_PALETTE

// Combo chart color palettes for left and right axes
export const COMBO_COLORS = {
  left: ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'], // Blue shades for left axis
  right: ['#10b981', '#f97316', '#a855f7', '#ec4899'] // Distinct colors for right axis
} as const
