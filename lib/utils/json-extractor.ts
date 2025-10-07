/**
 * JSON Extractor Utility
 *
 * Provides robust JSON extraction from strings that may contain:
 * - Markdown code fences (```json ... ```)
 * - Generic code fences (``` ... ```)
 * - Extra whitespace or text around JSON
 * - Mixed content with JSON embedded
 *
 * @module json-extractor
 */

/**
 * Result of JSON extraction attempt
 */
export interface ExtractionResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  strategy?: ExtractionStrategy
}

/**
 * Strategies attempted for JSON extraction
 */
export type ExtractionStrategy =
  | 'direct-parse'
  | 'json-fence-removal'
  | 'generic-fence-removal'
  | 'object-extraction'
  | 'array-extraction'

/**
 * Configuration options for JSON extraction
 */
export interface ExtractionOptions {
  /** Whether to throw an error on failure (default: true) */
  throwOnError?: boolean
  /** Whether to log extraction attempts (default: false) */
  verbose?: boolean
  /** Custom error message prefix */
  errorPrefix?: string
}

/**
 * Extract JSON from a string using multiple fallback strategies
 *
 * Attempts extraction in the following order:
 * 1. Direct JSON.parse() - fastest path for clean JSON
 * 2. Remove ```json ... ``` markdown fences
 * 3. Remove generic ``` ... ``` code fences
 * 4. Extract content between first { and last }
 * 5. Extract content between first [ and last ]
 *
 * @example
 * ```typescript
 * // Simple usage
 * const result = extractJSON('{"key": "value"}')
 * console.log(result.data) // { key: "value" }
 *
 * // With markdown fences
 * const markdown = '```json\n{"key": "value"}\n```'
 * const result2 = extractJSON(markdown)
 * console.log(result2.data) // { key: "value" }
 *
 * // With type safety
 * interface MyData { key: string }
 * const result3 = extractJSON<MyData>('{"key": "value"}')
 * console.log(result3.data?.key) // "value"
 *
 * // Without throwing on error
 * const result4 = extractJSON('invalid', { throwOnError: false })
 * if (!result4.success) {
 *   console.error(result4.error)
 * }
 * ```
 *
 * @param input - The string potentially containing JSON
 * @param options - Extraction configuration options
 * @returns ExtractionResult with parsed data or error information
 * @throws Error if extraction fails and throwOnError is true (default)
 */
export function extractJSON<T = unknown>(
  input: string,
  options: ExtractionOptions = {}
): ExtractionResult<T> {
  const {
    throwOnError = true,
    verbose = false,
    errorPrefix = 'JSON extraction failed'
  } = options

  if (!input || typeof input !== 'string') {
    const error = `${errorPrefix}: Input must be a non-empty string`
    if (throwOnError) throw new Error(error)
    return { success: false, error }
  }

  const strategies: Array<{
    name: ExtractionStrategy
    fn: (str: string) => string
  }> = [
    {
      name: 'direct-parse',
      fn: (str) => str.trim()
    },
    {
      name: 'json-fence-removal',
      fn: removeJSONFences
    },
    {
      name: 'generic-fence-removal',
      fn: removeGenericFences
    },
    {
      name: 'object-extraction',
      fn: extractObjectContent
    },
    {
      name: 'array-extraction',
      fn: extractArrayContent
    }
  ]

  for (const strategy of strategies) {
    try {
      const processed = strategy.fn(input)
      const parsed = JSON.parse(processed) as T

      if (verbose) {
        console.log(`[JSON Extractor] Success with strategy: ${strategy.name}`)
      }

      return {
        success: true,
        data: parsed,
        strategy: strategy.name
      }
    } catch (error) {
      if (verbose) {
        console.log(`[JSON Extractor] Strategy "${strategy.name}" failed:`, error)
      }
      // Continue to next strategy
      continue
    }
  }

  // All strategies failed
  const error = `${errorPrefix}: All extraction strategies failed. Input may not contain valid JSON.`
  if (throwOnError) throw new Error(error)

  return {
    success: false,
    error
  }
}

/**
 * Remove ```json ... ``` markdown code fences
 * Handles various fence formats:
 * - ```json\n{...}\n```
 * - ```json {...}```
 * - ``` json\n{...}\n```
 */
function removeJSONFences(input: string): string {
  let result = input.trim()

  // Remove leading ```json or ``` json with optional whitespace
  if (result.startsWith('```json')) {
    result = result.slice(7)
  } else if (result.startsWith('``` json')) {
    result = result.slice(8)
  }

  // Remove trailing ```
  if (result.endsWith('```')) {
    result = result.slice(0, -3)
  }

  return result.trim()
}

/**
 * Remove generic ``` ... ``` code fences
 */
function removeGenericFences(input: string): string {
  let result = input.trim()

  // Remove leading ```
  if (result.startsWith('```')) {
    result = result.slice(3)
    // If there's a language identifier on the same line, remove it
    const firstNewline = result.indexOf('\n')
    if (firstNewline !== -1) {
      const firstLine = result.slice(0, firstNewline).trim()
      // If first line is just a language identifier (no braces/brackets)
      if (firstLine && !firstLine.includes('{') && !firstLine.includes('[')) {
        result = result.slice(firstNewline + 1)
      }
    }
  }

  // Remove trailing ```
  if (result.endsWith('```')) {
    result = result.slice(0, -3)
  }

  return result.trim()
}

/**
 * Extract content between first { and last }
 * Useful for JSON embedded in text
 */
function extractObjectContent(input: string): string {
  const firstBrace = input.indexOf('{')
  const lastBrace = input.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error('No valid object braces found')
  }

  return input.slice(firstBrace, lastBrace + 1).trim()
}

/**
 * Extract content between first [ and last ]
 * Useful for JSON arrays embedded in text
 */
function extractArrayContent(input: string): string {
  const firstBracket = input.indexOf('[')
  const lastBracket = input.lastIndexOf(']')

  if (firstBracket === -1 || lastBracket === -1 || firstBracket >= lastBracket) {
    throw new Error('No valid array brackets found')
  }

  return input.slice(firstBracket, lastBracket + 1).trim()
}

/**
 * Convenience function that extracts and returns the data directly
 * Throws an error if extraction fails
 *
 * @example
 * ```typescript
 * const data = parseJSONFromString<MyType>('```json\n{...}\n```')
 * // data is MyType
 * ```
 */
export function parseJSONFromString<T = unknown>(input: string): T {
  const result = extractJSON<T>(input, { throwOnError: true })
  return result.data as T
}

/**
 * Safe version that returns null on failure instead of throwing
 *
 * @example
 * ```typescript
 * const data = safeExtractJSON<MyType>('invalid json')
 * if (data === null) {
 *   console.error('Failed to parse')
 * }
 * ```
 */
export function safeExtractJSON<T = unknown>(input: string): T | null {
  const result = extractJSON<T>(input, { throwOnError: false })
  return result.success ? result.data as T : null
}
