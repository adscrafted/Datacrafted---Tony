/**
 * Column Name Matcher Utility
 *
 * Provides production-ready column name normalization and matching with:
 * - Snake_case normalization (not kebab-case)
 * - Unicode handling and diacritics removal
 * - Reserved keyword collision avoidance
 * - Duplicate detection
 * - Tiered matching strategy for performance
 *
 * @module lib/utils/column-name-matcher
 */

/**
 * SQL and JavaScript reserved keywords that should not be used as column names
 */
const RESERVED_KEYWORDS = new Set([
  // SQL reserved keywords
  'select', 'from', 'where', 'join', 'inner', 'outer', 'left', 'right',
  'on', 'and', 'or', 'not', 'null', 'true', 'false', 'case', 'when',
  'then', 'else', 'end', 'in', 'exists', 'between', 'like', 'is',
  'order', 'group', 'by', 'having', 'limit', 'offset', 'union', 'all',
  'distinct', 'as', 'table', 'index', 'primary', 'foreign', 'key',
  'references', 'constraint', 'unique', 'check', 'default', 'create',
  'alter', 'drop', 'insert', 'update', 'delete', 'truncate', 'grant',
  'revoke', 'commit', 'rollback', 'transaction', 'savepoint',

  // JavaScript reserved keywords
  'break', 'continue', 'debugger', 'do', 'for', 'function', 'if',
  'return', 'switch', 'var', 'void', 'while', 'with', 'class',
  'const', 'let', 'enum', 'export', 'import', 'super', 'this',
  'await', 'yield', 'async', 'try', 'catch', 'finally', 'throw',
  'new', 'typeof', 'instanceof', 'delete', 'extends', 'implements',
  'interface', 'package', 'private', 'protected', 'public', 'static',
]);

/**
 * Maximum column name length (PostgreSQL limit is 63, MySQL is 64)
 */
const MAX_COLUMN_LENGTH = 64;

/**
 * Column matcher interface for efficient lookups
 */
export interface ColumnMatcher {
  /** Original column names */
  readonly originalColumns: readonly string[];

  /** Normalized column names */
  readonly normalizedColumns: readonly string[];

  /** Map from normalized name to original name(s) */
  readonly normalizedToOriginal: ReadonlyMap<string, readonly string[]>;

  /** Map from lowercase trimmed name to original name(s) */
  readonly lowerTrimToOriginal: ReadonlyMap<string, readonly string[]>;

  /** Set of exact original names for O(1) lookup */
  readonly exactNames: ReadonlySet<string>;
}

/**
 * Validation result for column existence check
 */
export interface ColumnValidationResult {
  /** Whether the column exists */
  exists: boolean;

  /** The matched original column name (if found) */
  matchedColumn?: string;

  /** The matching tier used (1=exact, 2=case-insensitive, 3=normalized) */
  matchTier?: 1 | 2 | 3;

  /** Error message if validation failed */
  error?: string;

  /** Suggestions for similar column names */
  suggestions?: string[];
}

/**
 * Removes diacritics (accents) from a string
 * Uses Unicode normalization (NFD) to decompose characters
 *
 * @param str - Input string with potential diacritics
 * @returns String with diacritics removed
 *
 * @example
 * removeDiacritics('café') // 'cafe'
 * removeDiacritics('naïve') // 'naive'
 * removeDiacritics('São Paulo') // 'Sao Paulo'
 */
function removeDiacritics(str: string): string {
  // Normalize to NFD (decomposed form) then remove combining diacritical marks
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalizes a column name to snake_case format
 *
 * Process:
 * 1. Unicode normalization (NFD)
 * 2. Remove diacritics
 * 3. Lowercase conversion
 * 4. Replace spaces and special chars with underscores
 * 5. Remove consecutive underscores
 * 6. Trim underscores from start/end
 * 7. Handle reserved keywords by appending '_col'
 * 8. Handle numeric-only names by prepending 'col_'
 * 9. Handle empty results with 'column_n' fallback
 * 10. Truncate to max length
 *
 * @param name - Original column name
 * @param index - Optional index for fallback naming (default: 0)
 * @returns Normalized snake_case column name
 *
 * @example
 * normalizeColumnName('First Name') // 'first_name'
 * normalizeColumnName('Café Revenue') // 'cafe_revenue'
 * normalizeColumnName('123') // 'col_123'
 * normalizeColumnName('SELECT') // 'select_col'
 * normalizeColumnName('user@email') // 'user_email'
 */
export function normalizeColumnName(name: string, index: number = 0): string {
  // Handle empty or whitespace-only strings
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return `column_${index}`;
  }

  // Step 1-2: Unicode normalization and remove diacritics
  let normalized = removeDiacritics(name);

  // Step 3: Lowercase
  normalized = normalized.toLowerCase();

  // Step 4: Replace spaces and special characters with underscores
  // Keep alphanumeric and underscores, replace everything else
  normalized = normalized.replace(/[^a-z0-9_]+/g, '_');

  // Step 5: Remove consecutive underscores
  normalized = normalized.replace(/_+/g, '_');

  // Step 6: Trim underscores from start and end
  normalized = normalized.replace(/^_+|_+$/g, '');

  // Step 7: Handle empty result after normalization
  if (normalized.length === 0) {
    return `column_${index}`;
  }

  // Step 8: Handle numeric-only names (must start with letter or underscore)
  if (/^\d+$/.test(normalized)) {
    normalized = `col_${normalized}`;
  }

  // Step 9: Handle names that start with a number
  if (/^\d/.test(normalized)) {
    normalized = `col_${normalized}`;
  }

  // Step 10: Truncate to max length
  if (normalized.length > MAX_COLUMN_LENGTH) {
    normalized = normalized.substring(0, MAX_COLUMN_LENGTH);
    // Remove trailing underscore if truncation created one
    normalized = normalized.replace(/_+$/, '');
  }

  // Step 11: Handle reserved keywords
  if (RESERVED_KEYWORDS.has(normalized)) {
    normalized = `${normalized}_col`;
    // Re-check length after appending
    if (normalized.length > MAX_COLUMN_LENGTH) {
      normalized = normalized.substring(0, MAX_COLUMN_LENGTH);
    }
  }

  return normalized;
}

/**
 * Creates a column matcher with optimized lookup structures
 *
 * Builds three-tier matching system:
 * - Tier 1: Exact match (O(1) Set lookup)
 * - Tier 2: Case-insensitive + trim (O(1) Map lookup)
 * - Tier 3: Full normalization (O(1) Map lookup)
 *
 * Also handles duplicate detection and provides warnings
 *
 * @param columns - Array of original column names
 * @returns ColumnMatcher with optimized lookup structures
 *
 * @example
 * const matcher = createColumnMatcher(['First Name', 'Last Name', 'Email']);
 * // Access via matcher.exactNames, matcher.normalizedToOriginal, etc.
 */
export function createColumnMatcher(columns: string[]): ColumnMatcher {
  // Validate input
  if (!Array.isArray(columns)) {
    throw new TypeError('columns must be an array');
  }

  // Handle empty array
  if (columns.length === 0) {
    return {
      originalColumns: [],
      normalizedColumns: [],
      normalizedToOriginal: new Map(),
      lowerTrimToOriginal: new Map(),
      exactNames: new Set(),
    };
  }

  // Filter out invalid column names
  const validColumns = columns.filter(
    col => col != null && typeof col === 'string' && col.trim().length > 0
  );

  if (validColumns.length === 0) {
    console.warn('All column names were invalid or empty');
    return {
      originalColumns: [],
      normalizedColumns: [],
      normalizedToOriginal: new Map(),
      lowerTrimToOriginal: new Map(),
      exactNames: new Set(),
    };
  }

  // Build lookup structures
  const exactNames = new Set<string>();
  const lowerTrimToOriginal = new Map<string, string[]>();
  const normalizedToOriginal = new Map<string, string[]>();
  const normalizedColumns: string[] = [];

  // Track duplicates for warnings
  const duplicateGroups: Map<string, string[]> = new Map();

  validColumns.forEach((col, index) => {
    // Tier 1: Exact match
    exactNames.add(col);

    // Tier 2: Case-insensitive + trim
    const lowerTrim = col.trim().toLowerCase();
    if (!lowerTrimToOriginal.has(lowerTrim)) {
      lowerTrimToOriginal.set(lowerTrim, []);
    }
    lowerTrimToOriginal.get(lowerTrim)!.push(col);

    // Tier 3: Full normalization
    const normalized = normalizeColumnName(col, index);
    normalizedColumns.push(normalized);

    if (!normalizedToOriginal.has(normalized)) {
      normalizedToOriginal.set(normalized, []);
    }
    normalizedToOriginal.get(normalized)!.push(col);

    // Track duplicates after normalization
    if (normalizedToOriginal.get(normalized)!.length > 1) {
      if (!duplicateGroups.has(normalized)) {
        duplicateGroups.set(normalized, []);
      }
      duplicateGroups.set(normalized, normalizedToOriginal.get(normalized)!);
    }
  });

  // Warn about duplicates
  if (duplicateGroups.size > 0) {
    console.warn('Column name normalization created duplicates:');
    duplicateGroups.forEach((originals, normalized) => {
      console.warn(`  "${normalized}" maps to: [${originals.map(o => `"${o}"`).join(', ')}]`);
    });
  }

  return {
    originalColumns: Object.freeze([...validColumns]),
    normalizedColumns: Object.freeze(normalizedColumns),
    normalizedToOriginal: new Map(
      Array.from(normalizedToOriginal.entries()).map(([k, v]) => [k, Object.freeze([...v])])
    ),
    lowerTrimToOriginal: new Map(
      Array.from(lowerTrimToOriginal.entries()).map(([k, v]) => [k, Object.freeze([...v])])
    ),
    exactNames: new Set(exactNames),
  };
}

/**
 * Validates that a column name exists using tiered matching strategy
 *
 * Matching strategy (in order):
 * 1. Exact match (fastest)
 * 2. Case-insensitive + trim (handles common variations)
 * 3. Full normalization (handles international chars, special chars)
 *
 * If no match found, provides suggestions based on Levenshtein distance
 *
 * @param name - Column name to validate
 * @param matcher - Column matcher created by createColumnMatcher
 * @returns Validation result with match info or suggestions
 *
 * @example
 * const matcher = createColumnMatcher(['First Name', 'Last Name']);
 * validateColumnExists('First Name', matcher) // { exists: true, matchedColumn: 'First Name', matchTier: 1 }
 * validateColumnExists('first name', matcher) // { exists: true, matchedColumn: 'First Name', matchTier: 2 }
 * validateColumnExists('FirstName', matcher) // { exists: false, suggestions: ['First Name'] }
 */
export function validateColumnExists(
  name: string,
  matcher: ColumnMatcher
): ColumnValidationResult {
  // Validate input
  if (!name || typeof name !== 'string') {
    return {
      exists: false,
      error: 'Column name must be a non-empty string',
    };
  }

  if (!matcher || !matcher.exactNames) {
    return {
      exists: false,
      error: 'Invalid column matcher provided',
    };
  }

  if (matcher.originalColumns.length === 0) {
    return {
      exists: false,
      error: 'No columns available to match against',
    };
  }

  // Tier 1: Exact match (O(1))
  if (matcher.exactNames.has(name)) {
    return {
      exists: true,
      matchedColumn: name,
      matchTier: 1,
    };
  }

  // Tier 2: Case-insensitive + trim (O(1))
  const lowerTrim = name.trim().toLowerCase();
  const tier2Matches = matcher.lowerTrimToOriginal.get(lowerTrim);
  if (tier2Matches && tier2Matches.length > 0) {
    return {
      exists: true,
      matchedColumn: tier2Matches[0], // Return first match
      matchTier: 2,
    };
  }

  // Tier 3: Full normalization (O(1))
  const normalized = normalizeColumnName(name);
  const tier3Matches = matcher.normalizedToOriginal.get(normalized);
  if (tier3Matches && tier3Matches.length > 0) {
    return {
      exists: true,
      matchedColumn: tier3Matches[0], // Return first match
      matchTier: 3,
    };
  }

  // No match found - generate suggestions
  const suggestions = generateSuggestions(name, matcher.originalColumns);

  return {
    exists: false,
    error: `Column "${name}" not found`,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Generates suggestions for similar column names using Levenshtein distance
 *
 * @param input - Input column name that wasn't found
 * @param availableColumns - Array of available column names
 * @param maxSuggestions - Maximum number of suggestions to return (default: 3)
 * @returns Array of suggested column names sorted by similarity
 */
function generateSuggestions(
  input: string,
  availableColumns: readonly string[],
  maxSuggestions: number = 3
): string[] {
  if (!input || availableColumns.length === 0) {
    return [];
  }

  // Calculate Levenshtein distance for each column
  const distances = availableColumns.map(col => ({
    column: col,
    distance: levenshteinDistance(input.toLowerCase(), col.toLowerCase()),
  }));

  // Sort by distance and take top suggestions
  distances.sort((a, b) => a.distance - b.distance);

  // Only suggest columns with reasonable similarity (distance <= 5 or <= 50% of input length)
  const threshold = Math.min(5, Math.ceil(input.length * 0.5));

  return distances
    .filter(d => d.distance <= threshold)
    .slice(0, maxSuggestions)
    .map(d => d.column);
}

/**
 * Calculates Levenshtein distance between two strings
 * (minimum number of single-character edits needed to change one string into another)
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance between the strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Helper function to find a column using the matcher
 * Returns the matched column name or undefined
 *
 * @param name - Column name to find
 * @param matcher - Column matcher
 * @returns Matched column name or undefined
 *
 * @example
 * const matcher = createColumnMatcher(['First Name', 'Last Name']);
 * findColumn('first name', matcher) // 'First Name'
 * findColumn('unknown', matcher) // undefined
 */
export function findColumn(
  name: string,
  matcher: ColumnMatcher
): string | undefined {
  const result = validateColumnExists(name, matcher);
  return result.exists ? result.matchedColumn : undefined;
}

/**
 * Helper function to find multiple columns at once
 * Returns an array of matched column names (undefined for not found)
 *
 * @param names - Array of column names to find
 * @param matcher - Column matcher
 * @returns Array of matched column names (undefined for not found)
 *
 * @example
 * const matcher = createColumnMatcher(['First Name', 'Last Name', 'Email']);
 * findColumns(['first name', 'email', 'unknown'], matcher)
 * // ['First Name', 'Email', undefined]
 */
export function findColumns(
  names: string[],
  matcher: ColumnMatcher
): (string | undefined)[] {
  return names.map(name => findColumn(name, matcher));
}

/**
 * Helper function to get all duplicate groups after normalization
 * Useful for debugging and data quality checks
 *
 * @param matcher - Column matcher
 * @returns Map of normalized names to their original column groups (only duplicates)
 *
 * @example
 * const matcher = createColumnMatcher(['First Name', 'first-name', 'FIRST_NAME']);
 * getDuplicateGroups(matcher)
 * // Map { 'first_name' => ['First Name', 'first-name', 'FIRST_NAME'] }
 */
export function getDuplicateGroups(
  matcher: ColumnMatcher
): Map<string, string[]> {
  const duplicates = new Map<string, string[]>();

  matcher.normalizedToOriginal.forEach((originals, normalized) => {
    if (originals.length > 1) {
      duplicates.set(normalized, [...originals]);
    }
  });

  return duplicates;
}
