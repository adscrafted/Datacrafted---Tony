import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Store debugging help',
    instructions: 'Since the store is not accessible from console, please check the browser developer tools for logs that show the store state. Look for logs with "Current store state" or run this in console instead:',
    alternative: `
// Try accessing the store via window object if it's exposed
if (window.__ZUSTAND_STORES__) {
  console.log('Zustand stores:', window.__ZUSTAND_STORES__)
} else {
  console.log('No Zustand stores found on window')
}

// Check if React DevTools can help
if (window.React) {
  console.log('React is available')
} else {
  console.log('React not on window')
}
    `
  })
}