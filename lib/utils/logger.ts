/**
 * Production-ready logging utility for Next.js application
 *
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Environment-aware logging (debug/info only in development)
 * - Structured logging with metadata support
 * - Timestamp and log level formatting
 * - Type-safe interface
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMetadata {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: LogMetadata;
  error?: Error;
}

class Logger {
  private readonly isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Format timestamp in ISO 8601 format
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format log level with color codes for terminal output
   */
  private formatLevel(level: LogLevel): string {
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
    };
    const reset = '\x1b[0m';

    const levelUpper = level.toUpperCase();
    return colors[level] + '[' + levelUpper + ']' + reset;
  }

  /**
   * Check if log should be output based on level and environment
   */
  private shouldLog(level: LogLevel): boolean {
    // Always log warn and error
    if (level === 'warn' || level === 'error') {
      return true;
    }

    // Only log debug and info in development
    return this.isDevelopment;
  }

  /**
   * Format and output log entry
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    const timestamp = '[' + entry.timestamp + ']';
    const level = this.formatLevel(entry.level);
    const message = entry.message;

    // Build log output
    const logParts = [timestamp, level, message];

    // Select appropriate console method
    const consoleMethod = entry.level === 'error'
      ? console.error
      : entry.level === 'warn'
      ? console.warn
      : console.log;

    // Output base log
    consoleMethod(logParts.join(' '));

    // Output metadata if present
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      consoleMethod('  Metadata:', entry.metadata);
    }

    // Output error details if present
    if (entry.error) {
      consoleMethod('  Error:', entry.error);
      if (entry.error.stack && this.isDevelopment) {
        consoleMethod('  Stack:', entry.error.stack);
      }
    }
  }

  /**
   * Generic log method (maps to info level for backward compatibility)
   * Use this when migrating from console.log
   */
  log(message: string, metadata?: LogMetadata): void {
    this.output({
      timestamp: this.getTimestamp(),
      level: 'info',
      message,
      metadata,
    });
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.output({
      timestamp: this.getTimestamp(),
      level: 'debug',
      message,
      metadata,
    });
  }

  /**
   * Log info message (development only)
   */
  info(message: string, metadata?: LogMetadata): void {
    this.output({
      timestamp: this.getTimestamp(),
      level: 'info',
      message,
      metadata,
    });
  }

  /**
   * Log warning message (always logged)
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.output({
      timestamp: this.getTimestamp(),
      level: 'warn',
      message,
      metadata,
    });
  }

  /**
   * Log error message (always logged)
   */
  error(message: string, error?: Error | unknown, metadata?: LogMetadata): void {
    // Handle error parameter
    let errorObj: Error | undefined;
    let metadataObj = metadata;

    if (error instanceof Error) {
      errorObj = error;
    } else if (error && typeof error === 'object') {
      // If error is an object but not Error instance, add to metadata
      metadataObj = { ...metadata, errorData: error };
    } else if (error !== undefined) {
      // If error is a primitive, add to metadata
      metadataObj = { ...metadata, errorValue: error };
    }

    this.output({
      timestamp: this.getTimestamp(),
      level: 'error',
      message,
      metadata: metadataObj,
      error: errorObj,
    });
  }

  /**
   * Create a child logger with a context prefix
   * Useful for adding component/module context to all logs
   */
  withContext(context: string): Logger {
    const parentLogger = this;
    const contextLogger = new Logger();

    // Override log methods to add context prefix
    const addContext = (message: string) => '[' + context + '] ' + message;

    contextLogger.debug = (message: string, metadata?: LogMetadata) => {
      parentLogger.debug(addContext(message), metadata);
    };

    contextLogger.info = (message: string, metadata?: LogMetadata) => {
      parentLogger.info(addContext(message), metadata);
    };

    contextLogger.warn = (message: string, metadata?: LogMetadata) => {
      parentLogger.warn(addContext(message), metadata);
    };

    contextLogger.error = (message: string, error?: Error | unknown, metadata?: LogMetadata) => {
      parentLogger.error(addContext(message), error, metadata);
    };

    return contextLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for consumers who want to create their own instances
export type { Logger, LogLevel, LogMetadata };
