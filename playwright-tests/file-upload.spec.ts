import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('File Upload Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should upload CSV file and display analysis', async ({ page }) => {
    // Check if we're on the home page
    await expect(page.getByText('AI-Powered Data Analytics')).toBeVisible()
    
    // Create a test CSV file
    const csvContent = 'name,age,salary\nJohn,30,50000\nJane,25,60000\nBob,35,70000'
    const csvPath = path.join(__dirname, 'fixtures', 'test-data.csv')
    
    // Upload the file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-data.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // Wait for analysis to complete
    await expect(page.getByText('Analyzing your data...')).toBeVisible()
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 })
    
    // Verify dashboard elements are present
    await expect(page.locator('[data-testid="chart-container"]')).toBeVisible()
    await expect(page.getByText('Data Insights')).toBeVisible()
  })

  test('should handle invalid file type', async ({ page }) => {
    const txtContent = 'This is not a CSV file'
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(txtContent)
    })
    
    // Should show error message
    await expect(page.getByText(/invalid file type/i)).toBeVisible()
  })

  test('should handle large file size', async ({ page }) => {
    // Create a large CSV content (over 50MB)
    const largeContent = 'name,value\n' + 'test,data\n'.repeat(5000000)
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'large-file.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(largeContent)
    })
    
    // Should show file size error
    await expect(page.getByText(/file size exceeds/i)).toBeVisible()
  })

  test('should support drag and drop upload', async ({ page }) => {
    const csvContent = 'product,price,category\nLaptop,1000,Electronics\nChair,200,Furniture'
    
    // Simulate drag and drop
    const dropZone = page.locator('[data-testid="drop-zone"]')
    
    await dropZone.dispatchEvent('dragenter', {
      dataTransfer: {
        items: [{
          kind: 'file',
          type: 'text/csv'
        }]
      }
    })
    
    await dropZone.dispatchEvent('drop', {
      dataTransfer: {
        files: [{
          name: 'test-drag-drop.csv',
          type: 'text/csv',
          size: csvContent.length
        }]
      }
    })
    
    // Should show drag state feedback
    await expect(page.locator('[data-testid="drag-active"]')).toBeVisible()
  })

  test('should display file information after upload', async ({ page }) => {
    const csvContent = 'id,name,score\n1,Alice,95\n2,Bob,87\n3,Charlie,92'
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'scores.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // Should display file name and size
    await expect(page.getByText('scores.csv')).toBeVisible()
    await expect(page.getByText(/\d+\s*bytes/)).toBeVisible()
  })

  test('should allow multiple file uploads in sequence', async ({ page }) => {
    // First file
    const csvContent1 = 'name,value\nTest1,100'
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'file1.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent1)
    })
    
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 })
    
    // Navigate back to upload for second file
    await page.goto('/')
    
    // Second file
    const csvContent2 = 'product,quantity\nWidget,50'
    
    await fileInput.setInputFiles({
      name: 'file2.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent2)
    })
    
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 30000 })
  })

  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept and fail the analysis request
    await page.route('/api/analyze', route => {
      route.abort('failed')
    })
    
    const csvContent = 'name,age\nJohn,30'
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // Should show error message
    await expect(page.getByText(/error.*analyzing/i)).toBeVisible()
  })

  test('should show progress during analysis', async ({ page }) => {
    // Delay the analysis response
    await page.route('/api/analyze', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })
    
    const csvContent = 'name,score\nAlice,95\nBob,87'
    
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // Should show loading state
    await expect(page.getByText('Analyzing your data...')).toBeVisible()
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
  })
})