import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Run this in browser console to debug state',
    script: `
// Debug current state
console.log('=== STATE DEBUG ===')
try {
  // Check if we can access the store
  if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') {
    console.log('✅ On dashboard page')
    
    // Try to get React DevTools data
    const reactRoot = document.querySelector('[data-reactroot]') || document.querySelector('#__next')
    console.log('React root found:', !!reactRoot)
    
    // Check for store in various ways
    console.log('Zustand stores available:', {
      useDataStore: typeof useDataStore !== 'undefined',
      window_stores: Object.keys(window).filter(k => k.includes('store') || k.includes('zustand'))
    })
    
    // Force page refresh to reset state
    console.log('To force reset: window.location.reload()')
  }
} catch (error) {
  console.error('Debug error:', error)
}
console.log('=== END DEBUG ===')
    `
  })
}