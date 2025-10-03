// Simple Auto-Placement Algorithm for Dashboard Charts
// This is an alternative to complex collision detection algorithms

import { Layout as GridLayout } from 'react-grid-layout'

interface ChartDimensions {
  w: number
  h: number
}

/**
 * SIMPLEST auto-placement algorithm that works reliably
 * Uses a simple grid flow pattern that prevents overlaps by design
 */
export class SimpleAutoPlacement {
  private gridCols: number
  private placedItems: GridLayout[] = []

  constructor(gridCols: number = 12) {
    this.gridCols = gridCols
  }

  /**
   * Add a new item to the layout
   * Returns the position where it should be placed
   */
  addItem(itemId: string, dimensions: ChartDimensions): GridLayout {
    const position = this.findNextPosition(dimensions)

    const layoutItem: GridLayout = {
      i: itemId,
      x: position.x,
      y: position.y,
      w: dimensions.w,
      h: dimensions.h
    }

    this.placedItems.push(layoutItem)
    return layoutItem
  }

  /**
   * Simple horizontal-first placement
   * Places items left-to-right, then top-to-bottom
   */
  private findNextPosition(dimensions: ChartDimensions): { x: number; y: number } {
    const { w, h } = dimensions

    // Start at the top
    let currentY = 0

    // Keep trying rows until we find space
    while (true) {
      // Try to place horizontally in this row
      for (let x = 0; x <= this.gridCols - w; x++) {
        const testPosition = { x, y: currentY }

        if (this.isPositionFree(testPosition, dimensions)) {
          return testPosition
        }
      }

      // No space in this row, try next row
      currentY += 1
    }
  }

  /**
   * Check if a position is free of collisions
   */
  private isPositionFree(position: { x: number; y: number }, dimensions: ChartDimensions): boolean {
    const { x, y } = position
    const { w, h } = dimensions

    // Check against all placed items
    for (const item of this.placedItems) {
      // Check if rectangles overlap
      const overlap = !(
        x >= item.x + item.w ||  // new item is to the right
        x + w <= item.x ||       // new item is to the left
        y >= item.y + item.h ||  // new item is below
        y + h <= item.y          // new item is above
      )

      if (overlap) {
        return false
      }
    }

    return true
  }

  /**
   * Reset the placer for a new layout
   */
  reset(): void {
    this.placedItems = []
  }

  /**
   * Get all placed items
   */
  getLayout(): GridLayout[] {
    return [...this.placedItems]
  }
}

/**
 * Even simpler approach: Two-column layout
 * Charts alternate between left (x=0, w=6) and right (x=6, w=6) columns
 */
export function createTwoColumnLayout(
  chartIds: string[],
  getChartDimensions: (index: number) => ChartDimensions
): GridLayout[] {
  const layout: GridLayout[] = []
  let leftY = 0
  let rightY = 0

  chartIds.forEach((chartId, index) => {
    const dimensions = getChartDimensions(index)

    // Determine which column to use based on which has less height
    const useLeftColumn = leftY <= rightY

    const layoutItem: GridLayout = {
      i: chartId,
      x: useLeftColumn ? 0 : 6,
      y: useLeftColumn ? leftY : rightY,
      w: Math.min(dimensions.w, 6), // Max half screen width
      h: dimensions.h
    }

    layout.push(layoutItem)

    // Update column heights
    if (useLeftColumn) {
      leftY += dimensions.h
    } else {
      rightY += dimensions.h
    }
  })

  return layout
}

/**
 * Simplest approach: Single column stacked layout
 * All charts are full width and stacked vertically
 */
export function createSingleColumnLayout(
  chartIds: string[],
  getChartDimensions: (index: number) => ChartDimensions
): GridLayout[] {
  const layout: GridLayout[] = []
  let currentY = 0

  chartIds.forEach((chartId, index) => {
    const dimensions = getChartDimensions(index)

    const layoutItem: GridLayout = {
      i: chartId,
      x: 0,
      y: currentY,
      w: 12, // Full width
      h: dimensions.h
    }

    layout.push(layoutItem)
    currentY += dimensions.h
  })

  return layout
}