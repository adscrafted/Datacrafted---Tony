/**
 * Test script for date detection enhancement
 * Tests the fixed date detection logic with various formats
 */

import { detectDateWithConfidence } from './lib/utils/schema-analyzer'

// Test cases for date detection
const testCases = [
  {
    name: 'dd-MMM-yy format (advertising data)',
    values: ['09-Sep-25', '10-Sep-25', '11-Sep-25'],
    expectedType: 'date',
    expectedConfidenceMin: 60
  },
  {
    name: 'dd-MMM-yyyy format',
    values: ['09-Sep-2025', '10-Sep-2025', '11-Sep-2025'],
    expectedType: 'date',
    expectedConfidenceMin: 60
  },
  {
    name: 'ISO format (YYYY-MM-DD)',
    values: ['2025-09-09', '2025-09-10', '2025-09-11'],
    expectedType: 'date',
    expectedConfidenceMin: 90
  },
  {
    name: 'US format (MM/DD/YYYY)',
    values: ['09/09/2025', '09/10/2025', '09/11/2025'],
    expectedType: 'date',
    expectedConfidenceMin: 90
  },
  {
    name: 'Natural language format',
    values: ['Jan 1, 2023', 'Feb 15, 2023', 'Mar 30, 2023'],
    expectedType: 'date',
    expectedConfidenceMin: 60
  },
  {
    name: 'Categorical (should NOT be date)',
    values: ['Campaign A', 'Campaign B', 'Campaign C'],
    expectedType: 'categorical',
    expectedConfidenceMax: 50
  },
  {
    name: 'Mixed format dates',
    values: ['09-Sep-25', '2025-09-10', '09/11/2025'],
    expectedType: 'date',
    expectedConfidenceMin: 50
  }
]

console.log('🧪 Testing Enhanced Date Detection\n')
console.log('=' .repeat(80))

let passedTests = 0
let failedTests = 0

testCases.forEach((testCase, index) => {
  const result = detectDateWithConfidence(testCase.values)

  const isDateCorrect = result.isDate === (testCase.expectedType === 'date')

  let isConfidenceCorrect = true
  if (testCase.expectedConfidenceMin !== undefined) {
    isConfidenceCorrect = result.confidence >= testCase.expectedConfidenceMin
  }
  if (testCase.expectedConfidenceMax !== undefined) {
    isConfidenceCorrect = result.confidence <= testCase.expectedConfidenceMax
  }

  const passed = isDateCorrect && isConfidenceCorrect

  if (passed) {
    passedTests++
    console.log(`✅ Test ${index + 1}: ${testCase.name}`)
  } else {
    failedTests++
    console.log(`❌ Test ${index + 1}: ${testCase.name}`)
  }

  console.log(`   Sample values: ${testCase.values.slice(0, 2).join(', ')}`)
  console.log(`   Expected: ${testCase.expectedType}`)
  console.log(`   Detected: ${result.isDate ? 'date' : 'not date'} (confidence: ${result.confidence}%)`)

  if (!passed) {
    console.log(`   ⚠️  FAILED: Expected ${testCase.expectedType === 'date' ? 'date' : 'non-date'} with confidence ${testCase.expectedConfidenceMin ? `>= ${testCase.expectedConfidenceMin}` : `<= ${testCase.expectedConfidenceMax}`}`)
  }

  console.log('')
})

console.log('=' .repeat(80))
console.log(`\n📊 Results: ${passedTests}/${testCases.length} tests passed`)

if (failedTests === 0) {
  console.log('✅ All tests passed! Date detection is working correctly.')
  process.exit(0)
} else {
  console.log(`❌ ${failedTests} test(s) failed. Please review the implementation.`)
  process.exit(1)
}