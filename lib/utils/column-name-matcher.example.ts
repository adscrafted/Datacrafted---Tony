/**
 * Example usage of column-name-matcher utility
 *
 * This file demonstrates the capabilities of the production-ready
 * column name normalization and matching system.
 *
 * To run: npx tsx lib/utils/column-name-matcher.example.ts
 */

import {
  normalizeColumnName,
  createColumnMatcher,
  validateColumnExists,
  findColumn,
  findColumns,
  getDuplicateGroups,
} from './column-name-matcher';

console.log('=== Column Name Matcher Examples ===\n');

// Example 1: Basic Normalization
console.log('1. Basic Normalization (snake_case):');
console.log('  "First Name" →', normalizeColumnName('First Name'));
console.log('  "Café Revenue" →', normalizeColumnName('Café Revenue'));
console.log('  "User@Email" →', normalizeColumnName('User@Email'));
console.log('  "123" →', normalizeColumnName('123'));
console.log('  "SELECT" →', normalizeColumnName('SELECT'));
console.log('  "São Paulo Population" →', normalizeColumnName('São Paulo Population'));
console.log();

// Example 2: Tiered Matching Strategy
console.log('2. Tiered Matching Strategy:');
const columns = [
  'First Name',
  'Last Name',
  'Email Address',
  'Phone Number',
  'Café Revenue',
  'São Paulo',
];

const matcher = createColumnMatcher(columns);
console.log('  Original columns:', matcher.originalColumns);
console.log('  Normalized columns:', matcher.normalizedColumns);
console.log();

// Example 3: Finding columns with different match tiers
console.log('3. Finding Columns (Different Match Tiers):');

// Tier 1: Exact match
const result1 = validateColumnExists('First Name', matcher);
console.log('  "First Name" (exact):', {
  exists: result1.exists,
  matched: result1.matchedColumn,
  tier: result1.matchTier,
});

// Tier 2: Case-insensitive + trim
const result2 = validateColumnExists('  first name  ', matcher);
console.log('  "  first name  " (case+trim):', {
  exists: result2.exists,
  matched: result2.matchedColumn,
  tier: result2.matchTier,
});

// Tier 3: Full normalization
const result3 = validateColumnExists('Cafe-Revenue', matcher);
console.log('  "Cafe-Revenue" (normalized):', {
  exists: result3.exists,
  matched: result3.matchedColumn,
  tier: result3.matchTier,
});

// Not found with suggestions
const result4 = validateColumnExists('FirstName', matcher);
console.log('  "FirstName" (not found):', {
  exists: result4.exists,
  error: result4.error,
  suggestions: result4.suggestions,
});
console.log();

// Example 4: International characters and special chars
console.log('4. International Characters & Special Characters:');
const internationalColumns = [
  'Café Revenue',
  'São Paulo',
  'Zürich Population',
  'Москва Temperature',
  '北京 Air Quality',
];

const intlMatcher = createColumnMatcher(internationalColumns);
console.log('  Original:', internationalColumns);
console.log('  Normalized:', intlMatcher.normalizedColumns);
console.log();

// Example 5: Duplicate detection
console.log('5. Duplicate Detection:');
const duplicateColumns = [
  'First Name',
  'first-name',
  'FIRST_NAME',
  'Last Name',
  'Email',
];

const dupMatcher = createColumnMatcher(duplicateColumns);
const duplicates = getDuplicateGroups(dupMatcher);
console.log('  Input:', duplicateColumns);
console.log('  Duplicates after normalization:');
duplicates.forEach((originals, normalized) => {
  console.log(`    "${normalized}" → [${originals.map(o => `"${o}"`).join(', ')}]`);
});
console.log();

// Example 6: Reserved keywords
console.log('6. Reserved Keywords Handling:');
const reservedColumns = ['SELECT', 'FROM', 'WHERE', 'name', 'email'];
const reservedMatcher = createColumnMatcher(reservedColumns);
console.log('  Original:', reservedColumns);
console.log('  Normalized:', reservedMatcher.normalizedColumns);
console.log();

// Example 7: Edge cases
console.log('7. Edge Cases:');
const edgeCases = [
  '',
  '   ',
  '123',
  '___',
  'a'.repeat(100), // Very long name
  '@#$%',
  'column-with-many---dashes',
];

const edgeMatcher = createColumnMatcher(edgeCases);
console.log('  Original:', edgeCases);
console.log('  Normalized:', edgeMatcher.normalizedColumns);
console.log();

// Example 8: Batch column finding
console.log('8. Batch Column Finding:');
const searchColumns = ['first name', 'email address', 'unknown', 'phone number'];
const found = findColumns(searchColumns, matcher);
console.log('  Searching for:', searchColumns);
console.log('  Found:', found);
console.log();

// Example 9: Performance characteristics
console.log('9. Performance Characteristics:');
const largeColumnSet = Array.from({ length: 1000 }, (_, i) => `Column ${i}`);
const largeMatcher = createColumnMatcher(largeColumnSet);

console.time('  Tier 1: Exact match (1000 lookups)');
for (let i = 0; i < 1000; i++) {
  findColumn(`Column ${i}`, largeMatcher);
}
console.timeEnd('  Tier 1: Exact match (1000 lookups)');

console.time('  Tier 2: Case-insensitive (1000 lookups)');
for (let i = 0; i < 1000; i++) {
  findColumn(`column ${i}`, largeMatcher);
}
console.timeEnd('  Tier 2: Case-insensitive (1000 lookups)');

console.time('  Tier 3: Normalized (1000 lookups)');
for (let i = 0; i < 1000; i++) {
  findColumn(`Column-${i}`, largeMatcher);
}
console.timeEnd('  Tier 3: Normalized (1000 lookups)');

console.log('\n=== All Examples Complete ===');
