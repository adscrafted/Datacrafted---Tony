#!/usr/bin/env node

/**
 * Performance testing script for the dashboard
 * Measures key metrics before and after optimizations
 */

const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')

async function runPerformanceTest() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()
  
  // Enable performance monitoring
  await page.setCacheEnabled(false) // Disable cache for accurate measurements
  
  const metrics = {
    timestamp: new Date().toISOString(),
    pageLoadTime: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    firstInputDelay: 0,
    cumulativeLayoutShift: 0,
    memoryUsage: 0,
    jsHeapSize: 0,
    bundleSize: 0,
    renderTime: 0
  }

  try {
    console.log('🚀 Starting performance test...')
    
    // Navigate to dashboard page
    const startTime = Date.now()
    await page.goto('http://localhost:3001/dashboard', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    })
    metrics.pageLoadTime = Date.now() - startTime
    
    console.log(`📊 Page loaded in ${metrics.pageLoadTime}ms`)

    // Collect Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {}
        
        // FCP - First Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          entries.forEach((entry) => {
            if (entry.name === 'first-contentful-paint') {
              vitals.fcp = entry.startTime
            }
          })
        }).observe({ entryTypes: ['paint'] })

        // LCP - Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          vitals.lcp = lastEntry.startTime
        }).observe({ entryTypes: ['largest-contentful-paint'] })

        // CLS - Cumulative Layout Shift
        let cls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              cls += entry.value
            }
          }
          vitals.cls = cls
        }).observe({ entryTypes: ['layout-shift'] })

        // Memory usage (if available)
        if (performance.memory) {
          vitals.jsHeapSize = performance.memory.usedJSHeapSize
          vitals.totalHeapSize = performance.memory.totalJSHeapSize
        }

        // Resolve after collecting metrics
        setTimeout(() => resolve(vitals), 2000)
      })
    })

    Object.assign(metrics, {
      firstContentfulPaint: webVitals.fcp || 0,
      largestContentfulPaint: webVitals.lcp || 0,
      cumulativeLayoutShift: webVitals.cls || 0,
      jsHeapSize: webVitals.jsHeapSize || 0
    })

    // Test chart rendering performance
    const renderStart = Date.now()
    await page.waitForSelector('.dashboard-container', { timeout: 10000 })
    await page.waitForSelector('[data-testid="chart-wrapper"]', { timeout: 5000 })
    metrics.renderTime = Date.now() - renderStart

    console.log('📈 Performance Metrics:')
    console.log(`  Page Load Time: ${metrics.pageLoadTime}ms`)
    console.log(`  First Contentful Paint: ${metrics.firstContentfulPaint.toFixed(2)}ms`)
    console.log(`  Largest Contentful Paint: ${metrics.largestContentfulPaint.toFixed(2)}ms`)
    console.log(`  Cumulative Layout Shift: ${metrics.cumulativeLayoutShift.toFixed(4)}`)
    console.log(`  Chart Render Time: ${metrics.renderTime}ms`)
    console.log(`  JS Heap Size: ${(metrics.jsHeapSize / 1024 / 1024).toFixed(2)}MB`)

    // Performance scoring
    const score = calculatePerformanceScore(metrics)
    console.log(`\n🏆 Performance Score: ${score}/100`)
    
    // Save metrics to file
    const metricsFile = path.join(__dirname, '../performance-metrics.json')
    let allMetrics = []
    
    if (fs.existsSync(metricsFile)) {
      allMetrics = JSON.parse(fs.readFileSync(metricsFile, 'utf8'))
    }
    
    allMetrics.push({ ...metrics, score })
    fs.writeFileSync(metricsFile, JSON.stringify(allMetrics, null, 2))
    
    console.log(`\n💾 Metrics saved to ${metricsFile}`)

  } catch (error) {
    console.error('❌ Performance test failed:', error.message)
  } finally {
    await browser.close()
  }
}

function calculatePerformanceScore(metrics) {
  // Scoring based on Core Web Vitals thresholds
  let score = 100

  // FCP scoring (good: <1800ms, needs improvement: <3000ms, poor: >3000ms)
  if (metrics.firstContentfulPaint > 3000) score -= 20
  else if (metrics.firstContentfulPaint > 1800) score -= 10

  // LCP scoring (good: <2500ms, needs improvement: <4000ms, poor: >4000ms)
  if (metrics.largestContentfulPaint > 4000) score -= 25
  else if (metrics.largestContentfulPaint > 2500) score -= 15

  // CLS scoring (good: <0.1, needs improvement: <0.25, poor: >0.25)
  if (metrics.cumulativeLayoutShift > 0.25) score -= 20
  else if (metrics.cumulativeLayoutShift > 0.1) score -= 10

  // Page load time scoring
  if (metrics.pageLoadTime > 5000) score -= 15
  else if (metrics.pageLoadTime > 3000) score -= 8

  // Chart render time scoring
  if (metrics.renderTime > 2000) score -= 10
  else if (metrics.renderTime > 1000) score -= 5

  return Math.max(0, Math.round(score))
}

// Run if called directly
if (require.main === module) {
  runPerformanceTest().catch(console.error)
}

module.exports = { runPerformanceTest, calculatePerformanceScore }