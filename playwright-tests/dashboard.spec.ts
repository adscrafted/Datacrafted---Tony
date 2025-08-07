import { test, expect } from '@playwright/test'

test.describe('Dashboard Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Upload a sample file first to get to dashboard
    await page.goto('/')
    
    const csvContent = 'product,price,category,sales\nLaptop,1200,Electronics,15\nMouse,25,Electronics,45\nChair,300,Furniture,8\nDesk,500,Furniture,12'
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'sample-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // Wait for dashboard to load
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 })
  })

  test('should display multiple chart types', async ({ page }) => {
    // Check for different chart containers
    await expect(page.locator('[data-testid="chart-container"]').first()).toBeVisible()
    
    // Should have at least one chart
    const chartCount = await page.locator('[data-testid="chart-container"]').count()
    expect(chartCount).toBeGreaterThan(0)
    
    // Check for chart titles
    await expect(page.locator('h3').first()).toBeVisible()
  })

  test('should allow chart customization', async ({ page }) => {
    // Open customization panel
    await page.click('[data-testid="customize-chart-button"]')
    
    // Should show customization options
    await expect(page.getByText('Chart Type')).toBeVisible()
    await expect(page.getByText('Colors')).toBeVisible()
    
    // Change chart type
    await page.selectOption('[data-testid="chart-type-select"]', 'bar')
    
    // Apply changes
    await page.click('[data-testid="apply-changes-button"]')
    
    // Chart should update
    await expect(page.locator('[data-chart-type="bar"]')).toBeVisible()
  })

  test('should support theme switching', async ({ page }) => {
    // Open theme panel
    await page.click('[data-testid="theme-toggle-button"]')
    
    // Switch to dark theme
    await page.click('[data-testid="dark-theme-button"]')
    
    // Check if dark theme is applied
    await expect(page.locator('body')).toHaveAttribute('data-theme', 'dark')
    
    // Switch back to light theme
    await page.click('[data-testid="light-theme-button"]')
    await expect(page.locator('body')).not.toHaveAttribute('data-theme', 'dark')
  })

  test('should export charts as images', async ({ page }) => {
    // Start download listener
    const downloadPromise = page.waitForEvent('download')
    
    // Click export button
    await page.click('[data-testid="export-chart-button"]')
    await page.click('[data-testid="export-png-button"]')
    
    // Wait for download
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/chart.*\.png$/)
  })

  test('should filter data correctly', async ({ page }) => {
    // Open filter panel
    await page.click('[data-testid="filter-button"]')
    
    // Apply category filter
    await page.selectOption('[data-testid="category-filter"]', 'Electronics')
    await page.click('[data-testid="apply-filter-button"]')
    
    // Charts should update to show only Electronics data
    await expect(page.locator('[data-testid="filtered-data"]')).toBeVisible()
    
    // Should not show Furniture items
    await expect(page.getByText('Chair')).not.toBeVisible()
    await expect(page.getByText('Laptop')).toBeVisible()
  })

  test('should save and load dashboard sessions', async ({ page }) => {
    // Save session
    await page.click('[data-testid="save-session-button"]')
    await page.fill('[data-testid="session-name-input"]', 'Test Dashboard')
    await page.click('[data-testid="confirm-save-button"]')
    
    // Should show success message
    await expect(page.getByText('Session saved')).toBeVisible()
    
    // Navigate away and back
    await page.goto('/')
    
    // Load saved session
    await page.click('[data-testid="load-session-button"]')
    await page.click('[data-testid="session-Test Dashboard"]')
    
    // Should restore the dashboard
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible()
  })

  test('should handle responsive layout', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Charts should stack vertically on mobile
    const charts = page.locator('[data-testid="chart-container"]')
    const firstChart = charts.first()
    const secondChart = charts.nth(1)
    
    if (await secondChart.isVisible()) {
      const firstBox = await firstChart.boundingBox()
      const secondBox = await secondChart.boundingBox()
      
      // Second chart should be below first chart (higher y position)
      expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height - 50)
    }
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    
    // Charts should be arranged horizontally on desktop
    if (await secondChart.isVisible()) {
      const firstBox = await firstChart.boundingBox()
      const secondBox = await secondChart.boundingBox()
      
      // Charts might be side by side or in a grid
      expect(Math.abs(firstBox!.y - secondBox!.y)).toBeLessThan(100)
    }
  })

  test('should show data insights panel', async ({ page }) => {
    // Check for insights panel
    await expect(page.getByText('Data Insights')).toBeVisible()
    
    // Should have at least one insight
    const insights = page.locator('[data-testid="insight-item"]')
    const insightCount = await insights.count()
    expect(insightCount).toBeGreaterThan(0)
    
    // Insights should be meaningful
    await expect(insights.first()).toContainText(/\w+/)
  })

  test('should support chart interactions', async ({ page }) => {
    const chart = page.locator('[data-testid="chart-container"]').first()
    
    // Hover over chart elements should show tooltips
    await chart.locator('.recharts-bar, .recharts-line-dot, .recharts-pie-sector').first().hover()
    
    // Should show tooltip with data
    await expect(page.locator('.recharts-tooltip-wrapper')).toBeVisible()
  })

  test('should handle undo/redo functionality', async ({ page }) => {
    // Make a change (customize chart)
    await page.click('[data-testid="customize-chart-button"]')
    await page.selectOption('[data-testid="chart-type-select"]', 'pie')
    await page.click('[data-testid="apply-changes-button"]')
    
    // Chart should change to pie
    await expect(page.locator('[data-chart-type="pie"]')).toBeVisible()
    
    // Undo the change
    await page.click('[data-testid="undo-button"]')
    
    // Chart should revert
    await expect(page.locator('[data-chart-type="pie"]')).not.toBeVisible()
    
    // Redo the change
    await page.click('[data-testid="redo-button"]')
    
    // Chart should be pie again
    await expect(page.locator('[data-chart-type="pie"]')).toBeVisible()
  })
})