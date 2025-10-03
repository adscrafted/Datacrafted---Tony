/**
 * Simple JavaScript test for date detection
 * Tests the enhanced date pattern matching
 */

// Enhanced date format patterns (copied from schema-analyzer.ts)
const DATE_PATTERNS = [
  // ISO formats
  /^\d{4}-\d{2}-\d{2}$/,                          // 2023-01-01
  /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/,          // 2023-01-01T12:00 or 2023-01-01 12:00

  // US formats
  /^\d{1,2}\/\d{1,2}\/\d{4}$/,                   // 1/1/2023 or 01/01/2023
  /^\d{1,2}-\d{1,2}-\d{4}$/,                       // 1-1-2023

  // EU formats
  /^\d{1,2}\.\d{1,2}\.\d{4}$/,                   // 01.01.2023

  // Natural language formats
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}$/i, // Jan 1, 2023
  /^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i,    // 1 Jan 2023
  /^\d{1,2}-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2,4}$/i,      // 09-Sep-25 or 09-Sep-2025 ⭐ NEW
  /^\d{1,2}\/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{2,4}$/i,    // 09/Sep/25 ⭐ NEW

  // Quarter formats
  /^Q[1-4]\s+\d{4}$/i,                              // Q1 2023
  /^\d{4}\s+Q[1-4]$/i,                              // 2023 Q1

  // Month-Year formats
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i,  // Jan 2023
  /^\d{4}-(0[1-9]|1[0-2])$/,                        // 2023-01

  // Year only
  /^\d{4}$/,                                         // 2023

  // Time only
  /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i         // 14:30 or 2:30 PM
]

function detectDateWithConfidence(values) {
  if (!values || values.length === 0) {
    return { isDate: false, confidence: 0 }
  }

  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '')
  if (nonNullValues.length === 0) {
    return { isDate: false, confidence: 0 }
  }

  let matchCount = 0
  let parsableCount = 0

  for (const value of nonNullValues) {
    const str = String(value).trim()

    // Check if it's parseable as a date
    const parsed = Date.parse(str)
    if (!isNaN(parsed)) {
      parsableCount++

      // Check against our patterns
      for (let i = 0; i < DATE_PATTERNS.length; i++) {
        if (DATE_PATTERNS[i].test(str)) {
          matchCount++
          break
        }
      }
    }
  }

  const matchRatio = matchCount / nonNullValues.length
  const parseRatio = parsableCount / nonNullValues.length

  // Calculate confidence based on multiple factors
  let confidence = 0
  if (matchRatio >= 0.8) {
    confidence = 90 + (matchRatio - 0.8) * 50 // 90-100% for very high match
  } else if (matchRatio >= 0.5) {
    confidence = 70 + (matchRatio - 0.5) * 40 // 70-90% for good match
  } else if (parseRatio >= 0.7) {
    confidence = 50 + (parseRatio - 0.7) * 67 // 50-70% for parseable dates
  } else {
    confidence = parseRatio * 50 // 0-50% for low match
  }

  return {
    isDate: confidence >= 60, // 60% threshold for date detection
    confidence: Math.round(confidence)
  }
}

// Test cases for date detection
const testCases = [
  {
    name: 'dd-MMM-yy format (advertising data) ⭐ MAIN FIX',
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
console.log('='.repeat(80))

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

console.log('='.repeat(80))
console.log(`\n📊 Results: ${passedTests}/${testCases.length} tests passed`)

if (failedTests === 0) {
  console.log('✅ All tests passed! Date detection is working correctly.')
  process.exit(0)
} else {
  console.log(`❌ ${failedTests} test(s) failed. Please review the implementation.`)
  process.exit(1)
}