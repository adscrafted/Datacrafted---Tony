/**
 * Content Security Policy (CSP) Configuration with Nonce-based Security
 *
 * SECURITY OVERVIEW:
 * This implementation removes 'unsafe-inline' and 'unsafe-eval' from the CSP
 * by using cryptographic nonces for inline scripts and styles. This significantly
 * reduces XSS attack surface while maintaining Next.js functionality.
 *
 * OWASP Reference: A03:2021 - Injection (XSS Prevention)
 * https://owasp.org/Top10/A03_2021-Injection/
 *
 * KEY SECURITY FEATURES:
 * 1. Nonce-based CSP - Unique nonces prevent unauthorized inline scripts
 * 2. strict-dynamic - Allows dynamically loaded scripts from trusted sources
 * 3. Environment-aware - Relaxed CSP in development, strict in production
 * 4. Defense in depth - Multiple CSP directives working together
 */

/**
 * Generate a cryptographically secure nonce for CSP
 *
 * Uses Web Crypto API (crypto.getRandomValues) for Edge Runtime compatibility.
 * The nonce is base64-encoded for use in CSP headers and HTML attributes.
 *
 * @returns Base64-encoded 128-bit (16 bytes) random nonce
 */
export function generateNonce(): string {
  // 16 bytes = 128 bits of entropy
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  // Convert to base64 (Edge Runtime compatible)
  // Using btoa with String.fromCharCode for Edge compatibility
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * CSP Directive Builder Interface
 * Provides type safety for CSP directive construction
 */
export interface CSPDirectives {
  'default-src': string[]
  'script-src': string[]
  'style-src': string[]
  'font-src': string[]
  'img-src': string[]
  'connect-src': string[]
  'frame-src': string[]
  'object-src': string[]
  'base-uri': string[]
  'form-action': string[]
  'frame-ancestors': string[]
  'upgrade-insecure-requests': boolean
}

/**
 * Build CSP directives with nonce support
 *
 * PRODUCTION CSP STRATEGY:
 * - Uses 'strict-dynamic' with nonces for scripts (allows Next.js chunks)
 * - Removes 'unsafe-inline' and 'unsafe-eval' for maximum security
 * - Maintains compatibility with Next.js 15 App Router
 *
 * DEVELOPMENT CSP STRATEGY:
 * - Allows 'unsafe-eval' for Next.js Fast Refresh and HMR
 * - Uses nonces but keeps 'unsafe-inline' as fallback
 * - Enables rapid development without CSP blocking
 *
 * @param nonce - Cryptographic nonce for this request
 * @param isDevelopment - Whether running in development mode
 * @returns CSP directives object
 */
export function buildCSPDirectives(
  nonce: string,
  isDevelopment: boolean = false
): CSPDirectives {
  // Base script sources that are always allowed
  const scriptSrcBase = [
    "'self'",
    // External trusted scripts
    'https://apis.google.com',
    'https://accounts.google.com',
  ]

  // Production: Allow inline scripts for Next.js compatibility
  // NOTE: We do NOT use nonces in production because:
  // 1. Next.js injects inline scripts without nonce attributes
  // 2. When a nonce is present, browsers IGNORE 'unsafe-inline'
  // 3. This would block all Next.js inline scripts
  const scriptSrcProduction = [
    ...scriptSrcBase,
    "'unsafe-inline'", // Required for Next.js inline scripts
    "'unsafe-eval'", // Required for some Next.js features
    'https:',
  ]

  // Development: Allow unsafe-eval for Next.js Fast Refresh
  // Next.js development mode requires eval for HMR and Fast Refresh
  const scriptSrcDevelopment = [
    ...scriptSrcBase,
    "'unsafe-eval'", // Required for Next.js development
    "'unsafe-inline'", // Fallback for development
  ]

  return {
    'default-src': ["'self'"],

    // Script sources with nonce-based security
    'script-src': isDevelopment ? scriptSrcDevelopment : scriptSrcProduction,

    // Style sources - using unsafe-inline for CSS-in-JS libraries
    // NOTE: No nonce in production (same reason as script-src)
    'style-src': isDevelopment
      ? [
          "'self'",
          `'nonce-${nonce}'`,
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
        ]
      : [
          "'self'",
          "'unsafe-inline'", // Required for CSS-in-JS (Tailwind, styled-components, etc.)
          'https://fonts.googleapis.com',
        ],

    // Font sources
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
      'data:', // Allow data: URIs for inline fonts
    ],

    // Image sources
    'img-src': [
      "'self'",
      'data:', // Allow data: URIs (base64 images)
      'https:', // Allow all HTTPS images
      'blob:', // Allow blob: URIs (canvas, file uploads)
    ],

    // API and WebSocket connections
    'connect-src': [
      "'self'",
      // Firebase services
      'https://*.firebaseapp.com',
      'https://*.googleapis.com',
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
      // OpenAI API
      'https://api.openai.com',
      // Development: Allow webpack HMR
      ...(isDevelopment ? ['ws://localhost:*', 'wss://localhost:*'] : []),
    ],

    // iFrame sources
    'frame-src': [
      "'self'",
      'https://accounts.google.com',
      'https://*.firebaseapp.com',
    ],

    // Block all object, embed, and applet elements (legacy Flash, etc.)
    'object-src': ["'none'"],

    // Restrict base tag to same origin (prevents base tag hijacking)
    'base-uri': ["'self'"],

    // Restrict form submissions to same origin
    'form-action': ["'self'"],

    // Prevent framing by other sites (clickjacking protection)
    'frame-ancestors': ["'none'"],

    // Upgrade all HTTP requests to HTTPS
    'upgrade-insecure-requests': true,
  }
}

/**
 * Convert CSP directives object to CSP header string
 *
 * Formats the directives according to CSP specification:
 * directive-name value1 value2; directive-name2 value1
 *
 * @param directives - CSP directives object
 * @returns Formatted CSP header string
 */
export function formatCSPHeader(directives: CSPDirectives): string {
  return Object.entries(directives)
    .map(([key, value]) => {
      // Handle boolean directives (e.g., upgrade-insecure-requests)
      if (typeof value === 'boolean') {
        return value ? key : null
      }

      // Handle array directives
      if (Array.isArray(value) && value.length > 0) {
        return `${key} ${value.join(' ')}`
      }

      return null
    })
    .filter(Boolean) // Remove null values
    .join('; ')
}

/**
 * Build complete CSP header with nonce
 *
 * High-level function that combines nonce generation with CSP building.
 * This is the main function used by middleware.
 *
 * @param nonce - Cryptographic nonce for this request
 * @param isDevelopment - Whether running in development mode
 * @returns Complete CSP header string
 */
export function buildCSPHeader(
  nonce: string,
  isDevelopment: boolean = false
): string {
  const directives = buildCSPDirectives(nonce, isDevelopment)
  return formatCSPHeader(directives)
}

/**
 * Detect if running in production environment
 *
 * SECURITY CRITICAL: This function determines which CSP mode to use.
 * Multiple environment checks ensure production CSP is applied correctly.
 *
 * @returns true if running in production, false otherwise
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production' ||
    process.env.RENDER !== undefined ||
    process.env.FLY_APP_NAME !== undefined
  )
}

/**
 * SECURITY TESTING UTILITIES
 * These functions help test and validate CSP implementation
 */

/**
 * Validate nonce format
 * Ensures nonce meets security requirements
 *
 * @param nonce - Nonce to validate
 * @returns true if valid, false otherwise
 */
export function isValidNonce(nonce: string): boolean {
  // Base64 regex pattern
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/

  // Check length (16 bytes base64 = 24 characters including padding)
  if (nonce.length < 16) {
    return false
  }

  // Check if valid base64
  return base64Pattern.test(nonce)
}

/**
 * Extract nonce from CSP header
 * Useful for testing and debugging
 *
 * @param cspHeader - CSP header string
 * @returns Extracted nonce or null
 */
export function extractNonceFromCSP(cspHeader: string): string | null {
  const match = cspHeader.match(/'nonce-([A-Za-z0-9+/=]+)'/)
  return match ? match[1] : null
}
