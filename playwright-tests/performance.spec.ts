import { test, expect } from '@playwright/test'

test.describe('Performance Tests', () => {
  test('should handle large CSV files efficiently', async ({ page }) => {
    await page.goto('/')
    
    // Create a large CSV file (but within limits)
    const headerRow = 'id,name,email,age,salary,department,hire_date,performance_score'
    const dataRows = Array.from({ length: 10000 }, (_, i) => 
      `${i + 1},User${i + 1},user${i + 1}@example.com,${20 + (i % 40)},${30000 + (i % 50000)},Dept${i % 10},2020-01-01,${Math.random() * 100}`
    )
    const largeCsvContent = [headerRow, ...dataRows].join('\n')
    
    // Measure upload and processing time
    const startTime = Date.now()
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'large-dataset.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(largeCsvContent)
    })
    
    // Wait for analysis to complete
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 60000 })
    
    const endTime = Date.now()
    const processingTime = endTime - startTime
    
    console.log(`Large file processing time: ${processingTime}ms`)
    
    // Should complete within reasonable time (60 seconds)
    expect(processingTime).toBeLessThan(60000)
    
    // Dashboard should be responsive
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible()
  })

  test('should render charts quickly with large datasets', async ({ page }) => {
    await page.goto('/')
    
    // Upload a moderately large dataset
    const largeCsvContent = Array.from({ length: 5000 }, (_, i) => 
      `Product${i},${Math.random() * 1000},Category${i % 20}`
    ).join('\n')
    const csvWithHeader = 'product,price,category\n' + largeCsvContent
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'medium-dataset.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvWithHeader)
    })
    
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 })
    
    // Measure chart rendering time
    const startTime = Date.now()
    
    // Wait for all charts to be visible
    await expect(page.locator('[data-testid="chart-container"]').first()).toBeVisible()
    
    const endTime = Date.now()
    const renderTime = endTime - startTime
    
    console.log(`Chart rendering time: ${renderTime}ms`)
    
    // Charts should render quickly (under 5 seconds)
    expect(renderTime).toBeLessThan(5000)
  })

  test('should handle multiple concurrent uploads', async ({ browser }) => {
    // Create multiple pages to simulate concurrent users
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext()
    ])
    
    const pages = await Promise.all(contexts.map(context => context.newPage()))
    
    const csvContent = 'name,score,category\nTest,100,A\nUser,95,B'
    
    // Upload files concurrently
    const uploadPromises = pages.map(async (page, index) => {
      await page.goto('/')
      
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: `concurrent-test-${index}.csv`,
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent)
      })
      
      return page.waitForSelector('[data-testid="chart-container"]', { timeout: 30000 })
    })
    
    const startTime = Date.now()
    await Promise.all(uploadPromises)
    const endTime = Date.now()
    
    console.log(`Concurrent upload processing time: ${endTime - startTime}ms`)
    
    // All uploads should complete within reasonable time
    expect(endTime - startTime).toBeLessThan(45000)
    
    // Clean up
    await Promise.all(contexts.map(context => context.close()))
  })

  test('should maintain UI responsiveness during AI analysis', async ({ page }) => {
    await page.goto('/')
    
    const csvContent = 'product,sales,region,date\n' + Array.from({ length: 1000 }, (_, i) => 
      `Product${i},${Math.random() * 1000},Region${i % 5},2023-01-01`
    ).join('\n')
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'analysis-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // While analysis is running, UI should remain responsive
    await expect(page.getByText('Analyzing your data...')).toBeVisible()
    
    // Test UI interactions during analysis
    const cancelButton = page.locator('[data-testid="cancel-analysis-button"]')
    if (await cancelButton.isVisible()) {
      // Button should be clickable
      await expect(cancelButton).toBeEnabled()
    }
    
    // Navigation should work
    const homeLink = page.locator('[data-testid="home-link"]')
    if (await homeLink.isVisible()) {
      await expect(homeLink).toBeEnabled()
    }
    
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 })
  })

  test('should optimize memory usage with large datasets', async ({ page }) => {
    await page.goto('/')
    
    // Monitor memory usage (using Performance API if available)
    await page.evaluate(() => {
      (window as any).initialMemory = (performance as any).memory?.usedJSHeapSize || 0
    })
    
    const largeCsvContent = Array.from({ length: 8000 }, (_, i) => 
      `Item${i},${Math.random() * 1000},${Math.random() * 100},Category${i % 50}`
    ).join('\n')
    const csvWithHeader = 'item,price,quantity,category\n' + largeCsvContent
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'memory-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvWithHeader)
    })
    
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 45000 })
    
    // Check memory usage after processing
    const memoryIncrease = await page.evaluate(() => {
      const currentMemory = (performance as any).memory?.usedJSHeapSize || 0
      const initialMemory = (window as any).initialMemory || 0
      return currentMemory - initialMemory
    })
    
    console.log(`Memory increase: ${memoryIncrease / 1024 / 1024} MB`)
    
    // Memory increase should be reasonable (less than 100MB)
    if (memoryIncrease > 0) {
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // 100MB
    }
  })

  test('should handle network latency gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('/api/analyze', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000)) // 3s delay
      await route.continue()
    })
    
    await page.goto('/')
    
    const csvContent = 'name,value\nTest,100\nData,200'
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'network-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // Should show loading state immediately
    await expect(page.getByText('Analyzing your data...')).toBeVisible()
    
    // Loading indicator should be present
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
    
    // Should eventually complete
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 10000 })
  })

  test('should handle browser resource constraints', async ({ page }) => {
    // Throttle CPU to simulate slower devices
    const client = await page.context().newCDPSession(page)
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    
    await page.goto('/')
    
    const csvContent = Array.from({ length: 2000 }, (_, i) => 
      `Record${i},${Math.random() * 1000},Type${i % 10}`
    ).join('\n')
    const csvWithHeader = 'record,value,type\n' + csvContent
    
    const startTime = Date.now()
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'throttled-test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvWithHeader)
    })
    
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 60000 })
    
    const endTime = Date.now()
    const processingTime = endTime - startTime
    
    console.log(`Throttled processing time: ${processingTime}ms`)
    
    // Should complete even on slow devices (within 60 seconds)
    expect(processingTime).toBeLessThan(60000)
    
    // Disable throttling
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  })
})