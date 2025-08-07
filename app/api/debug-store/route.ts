import { NextResponse } from 'next/server'

export async function GET() {
  // This endpoint helps debug store state by providing browser-based debugging tools
  const debugScript = `
// Debug store state
console.log('=== STORE DEBUG ===')
const store = window.__ZUSTAND_STORE__ || (typeof useDataStore !== 'undefined' ? useDataStore.getState() : null)
if (store) {
  console.log('📊 Store state:', {
    rawData: store.rawData ? { length: store.rawData.length, sample: store.rawData.slice(0, 2) } : null,
    analysis: !!store.analysis,
    isAnalyzing: store.isAnalyzing,
    analysisProgress: store.analysisProgress,
    fileName: store.fileName,
    error: store.error
  })
} else {
  console.log('❌ Store not accessible')
}
console.log('=== END DEBUG ===')
  `

  return NextResponse.json({
    message: 'Store debug info',
    instructions: 'Run this in your browser console to debug store state:',
    script: debugScript
  })
}