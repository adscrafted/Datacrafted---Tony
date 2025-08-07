/**
 * Production-safe logger that removes console logs in production builds
 * This significantly improves performance by avoiding console operations
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args)
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args)
    }
  },
  
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args)
    }
  },
  
  error: (...args: any[]) => {
    // Always log errors, but in production could send to error tracking service
    console.error(...args)
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args)
    }
  },
  
  // Performance timing helper
  time: (label: string) => {
    if (isDevelopment) {
      console.time(label)
    }
  },
  
  timeEnd: (label: string) => {
    if (isDevelopment) {
      console.timeEnd(label)
    }
  }
}

// Export convenience functions
export const log = logger.log
export const logError = logger.error
export const logWarn = logger.warn
export const logInfo = logger.info
export const logDebug = logger.debug