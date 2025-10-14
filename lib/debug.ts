/**
 * Debug utility to control console logging
 * Set DEBUG_MODE to false in production to disable verbose logging
 */

// Change this to false to disable all debug logs
const DEBUG_MODE = typeof window !== 'undefined'
  ? window.localStorage.getItem('DEBUG_MODE') === 'true'
  : false;

export const debug = {
  log: DEBUG_MODE ? console.log.bind(console) : () => {},
  warn: console.warn.bind(console), // Always show warnings
  error: console.error.bind(console), // Always show errors

  // Specific debug categories - can be individually controlled
  chart: DEBUG_MODE ? console.log.bind(console) : () => {},
  store: DEBUG_MODE ? console.log.bind(console) : () => {},
  panel: DEBUG_MODE ? console.log.bind(console) : () => {},

  // Enable/disable debug mode
  enable: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('DEBUG_MODE', 'true');
      console.log('✅ Debug mode ENABLED. Reload page to see debug logs.');
    }
  },

  disable: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('DEBUG_MODE', 'false');
      console.log('❌ Debug mode DISABLED. Reload page to hide debug logs.');
    }
  },

  isEnabled: () => DEBUG_MODE
};

// Make it globally accessible for easy toggling in console
if (typeof window !== 'undefined') {
  (window as any).debug = debug;
}
