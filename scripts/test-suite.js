#!/usr/bin/env node

/**
 * Comprehensive Test Suite Runner
 * 
 * This script runs the complete test suite and generates a detailed report
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

class TestRunner {
  constructor() {
    this.results = {
      unit: null,
      integration: null,
      e2e: null,
      performance: null,
      build: null,
      lint: null,
      typeCheck: null
    }
    this.startTime = Date.now()
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString()
    const prefix = {
      info: '✓',
      warn: '⚠',
      error: '✗',
      start: '▶'
    }[type] || 'ℹ'
    
    console.log(`${prefix} [${timestamp}] ${message}`)
  }

  async runCommand(command, description, critical = true) {
    this.log(`Starting: ${description}`, 'start')
    const startTime = Date.now()
    
    try {
      const output = execSync(command, { 
        encoding: 'utf8', 
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })
      
      const duration = Date.now() - startTime
      this.log(`Completed: ${description} (${duration}ms)`)
      
      return {
        success: true,
        output,
        duration,
        command,
        description
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const message = `Failed: ${description} (${duration}ms)`
      
      if (critical) {
        this.log(message, 'error')
        throw error
      } else {
        this.log(message, 'warn')
        return {
          success: false,
          error: error.message,
          duration,
          command,
          description
        }
      }
    }
  }

  async runBuildTests() {
    this.log('Running Build Tests...')
    
    // Type checking
    this.results.typeCheck = await this.runCommand(
      'npm run type-check',
      'TypeScript type checking'
    )
    
    // Linting
    this.results.lint = await this.runCommand(
      'npm run lint',
      'ESLint code quality check'
    )
    
    // Build test
    this.results.build = await this.runCommand(
      'npm run build',
      'Production build'
    )
  }

  async runUnitTests() {
    this.log('Running Unit Tests...')
    
    this.results.unit = await this.runCommand(
      'npm test -- --coverage --watchAll=false --verbose',
      'Jest unit tests with coverage'
    )
  }

  async runE2ETests() {
    this.log('Running End-to-End Tests...')
    
    try {
      // Install Playwright browsers if needed
      await this.runCommand(
        'npx playwright install --with-deps',
        'Installing Playwright browsers',
        false
      )
      
      // Run E2E tests
      this.results.e2e = await this.runCommand(
        'npm run test:e2e -- --reporter=json',
        'Playwright E2E tests'
      )
    } catch (error) {
      this.log('E2E tests failed, but continuing...', 'warn')
      this.results.e2e = {
        success: false,
        error: error.message,
        command: 'npm run test:e2e',
        description: 'Playwright E2E tests'
      }
    }
  }

  async runPerformanceTests() {
    this.log('Running Performance Tests...')
    
    try {
      this.results.performance = await this.runCommand(
        'npm run test:e2e -- performance.spec.ts --reporter=json',
        'Performance benchmarks',
        false
      )
    } catch (error) {
      this.log('Performance tests skipped due to error', 'warn')
      this.results.performance = {
        success: false,
        error: error.message,
        command: 'npm run test:e2e -- performance.spec.ts',
        description: 'Performance benchmarks'
      }
    }
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration,
      results: this.results,
      summary: {
        total: Object.keys(this.results).length,
        passed: Object.values(this.results).filter(r => r?.success).length,
        failed: Object.values(this.results).filter(r => r && !r.success).length,
        skipped: Object.values(this.results).filter(r => r === null).length
      }
    }
    
    // Save detailed report
    const reportPath = path.join(__dirname, '../test-results')
    if (!fs.existsSync(reportPath)) {
      fs.mkdirSync(reportPath, { recursive: true })
    }
    
    fs.writeFileSync(
      path.join(reportPath, 'test-report.json'),
      JSON.stringify(report, null, 2)
    )
    
    // Generate summary
    this.printSummary(report)
    
    return report
  }

  printSummary(report) {
    console.log('\n' + '='.repeat(60))
    console.log('TEST SUITE SUMMARY')
    console.log('='.repeat(60))
    
    console.log(`Total Duration: ${Math.round(report.totalDuration / 1000)}s`)
    console.log(`Tests Passed: ${report.summary.passed}/${report.summary.total}`)
    console.log(`Tests Failed: ${report.summary.failed}`)
    console.log(`Tests Skipped: ${report.summary.skipped}`)
    
    console.log('\nDetailed Results:')
    console.log('-'.repeat(40))
    
    Object.entries(this.results).forEach(([test, result]) => {
      if (result === null) {
        console.log(`${test.padEnd(15)}: SKIPPED`)
      } else if (result.success) {
        console.log(`${test.padEnd(15)}: PASSED (${result.duration}ms)`)
      } else {
        console.log(`${test.padEnd(15)}: FAILED`)
        if (result.error) {
          console.log(`  Error: ${result.error.substring(0, 100)}...`)
        }
      }
    })
    
    if (report.summary.failed > 0) {
      console.log('\n❌ Some tests failed. Check the detailed report for more information.')
      console.log(`Report saved to: ${path.join(__dirname, '../test-results/test-report.json')}`)
    } else {
      console.log('\n✅ All tests passed successfully!')
    }
    
    console.log('='.repeat(60))
  }

  async runHealthCheck() {
    this.log('Running application health check...')
    
    try {
      // Start the application in background for health check
      const { spawn } = require('child_process')
      
      const app = spawn('npm', ['start'], {
        stdio: 'pipe',
        env: { ...process.env, PORT: '3001' }
      })
      
      // Wait for app to start
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Run health check
      const healthResult = await this.runCommand(
        'HEALTH_CHECK_URL=http://localhost:3001/health node scripts/health-check.js',
        'Application health check',
        false
      )
      
      // Kill the app
      app.kill('SIGTERM')
      
      return healthResult
    } catch (error) {
      this.log('Health check failed or skipped', 'warn')
      return {
        success: false,
        error: error.message,
        description: 'Application health check'
      }
    }
  }
}

async function main() {
  const runner = new TestRunner()
  
  console.log('🚀 Starting DataCrafted Test Suite')
  console.log('This may take several minutes...\n')
  
  try {
    // Run tests in logical order
    await runner.runBuildTests()
    await runner.runUnitTests()
    
    // Start application for E2E tests
    runner.log('Starting application for E2E tests...')
    const { spawn } = require('child_process')
    const app = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe',
      env: { ...process.env, PORT: '3000' }
    })
    
    // Wait for application to be ready
    await new Promise(resolve => setTimeout(resolve, 15000))
    
    await runner.runE2ETests()
    await runner.runPerformanceTests()
    
    // Stop application
    app.kill('SIGTERM')
    
    // Generate final report
    const report = runner.generateReport()
    
    // Exit with appropriate code
    process.exit(report.summary.failed > 0 ? 1 : 0)
    
  } catch (error) {
    runner.log(`Test suite failed: ${error.message}`, 'error')
    
    // Still generate report with what we have
    runner.generateReport()
    process.exit(1)
  }
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️  Test suite interrupted by user')
  process.exit(1)
})

if (require.main === module) {
  main()
}