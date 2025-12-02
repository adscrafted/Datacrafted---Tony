/**
 * Client-Side Debug Logging Utility
 *
 * SECURITY: This utility is for CLIENT-SIDE logging only.
 * It does NOT bypass authentication or security checks.
 * It only controls console logging verbosity for development debugging.
 *
 * Usage:
 *   debug.log('message')           - General debug logs
 *   debug.chart('chart data')      - Chart-specific logs
 *   debug.store('store update')    - State management logs
 *   debug.panel('panel data')      - Panel-specific logs
 *
 * Control from browser console:
 *   debug.enable()   - Turn on debug logs (stored in localStorage)
 *   debug.disable()  - Turn off debug logs
 *
 * IMPORTANT: This is separate from server-side DEBUG_MODE which bypasses authentication.
 * This is purely for development logging convenience.
 */

// Check localStorage for debug logging preference (client-side only)
const isDebugLoggingEnabled = typeof window !== 'undefined'
  ? window.localStorage.getItem('DEBUG_LOGGING') === 'true'
  : false;

export const debug = {
  log: isDebugLoggingEnabled ? console.log.bind(console) : () => {},
  warn: console.warn.bind(console), // Always show warnings
  error: console.error.bind(console), // Always show errors

  // Specific debug categories - can be individually controlled
  chart: isDebugLoggingEnabled ? console.log.bind(console) : () => {},
  store: isDebugLoggingEnabled ? console.log.bind(console) : () => {},
  panel: isDebugLoggingEnabled ? console.log.bind(console) : () => {},

  // Enable/disable debug logging
  enable: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('DEBUG_LOGGING', 'true');
      console.log('✅ Debug logging ENABLED. Reload page to see debug logs.');
      console.log('   Note: This only controls console logging, not authentication.');
    }
  },

  disable: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('DEBUG_LOGGING', 'false');
      console.log('❌ Debug logging DISABLED. Reload page to hide debug logs.');
    }
  },

  isEnabled: () => isDebugLoggingEnabled
};

// Make it globally accessible for easy toggling in browser console
if (typeof window !== 'undefined') {
  (window as any).debug = debug;
}
