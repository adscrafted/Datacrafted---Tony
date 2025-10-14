/**
 * Manual test script for DataCompressionService
 * Run with: npx ts-node lib/services/__tests__/test-compression-manual.ts
 */

import {
  DataCompressionService,
  CompressionAlgorithm,
  compressData,
  decompressData
} from '../data-compression';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  log('DataCompressionService - Manual Test Suite', 'cyan');
  console.log('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Basic Compression and Decompression
  try {
    log('Test 1: Basic Compression and Decompression', 'blue');
    const service = new DataCompressionService();
    const data = [
      { id: 1, name: 'John Doe', age: 30, city: 'New York' },
      { id: 2, name: 'Jane Smith', age: 25, city: 'Los Angeles' },
      { id: 3, name: 'Bob Johnson', age: 35, city: 'Chicago' }
    ];

    const compressed = await service.compress(data);
    const decompressed = await service.decompress(compressed.buffer);

    if (JSON.stringify(data) === JSON.stringify(decompressed)) {
      log('✓ Compression and decompression successful', 'green');
      log(`  Original size: ${formatBytes(compressed.metadata.originalSize)}`, 'reset');
      log(`  Compressed size: ${formatBytes(compressed.metadata.compressedSize)}`, 'reset');
      log(`  Compression ratio: ${(compressed.metadata.compressionRatio * 100).toFixed(2)}%`, 'reset');
      log(`  Space saved: ${((1 - compressed.metadata.compressionRatio) * 100).toFixed(2)}%`, 'reset');
      passed++;
    } else {
      throw new Error('Data mismatch after decompression');
    }
  } catch (error) {
    log(`✗ Test 1 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  console.log();

  // Test 2: Large Dataset
  try {
    log('Test 2: Large Dataset (5000 rows)', 'blue');
    const service = new DataCompressionService();
    const largeData = Array.from({ length: 5000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: Math.floor(Math.random() * 80) + 18,
      address: `${i} Main St, City ${i % 100}, State ${i % 50}`,
      phone: `555-${String(i).padStart(4, '0')}`,
      active: i % 2 === 0
    }));

    const startCompress = Date.now();
    const compressed = await service.compress(largeData);
    const compressTime = Date.now() - startCompress;

    const startDecompress = Date.now();
    const decompressed = await service.decompress(compressed.buffer);
    const decompressTime = Date.now() - startDecompress;

    if (JSON.stringify(largeData) === JSON.stringify(decompressed)) {
      log('✓ Large dataset compression successful', 'green');
      log(`  Rows: ${largeData.length}`, 'reset');
      log(`  Original size: ${formatBytes(compressed.metadata.originalSize)}`, 'reset');
      log(`  Compressed size: ${formatBytes(compressed.metadata.compressedSize)}`, 'reset');
      log(`  Compression ratio: ${(compressed.metadata.compressionRatio * 100).toFixed(2)}%`, 'reset');
      log(`  Space saved: ${((1 - compressed.metadata.compressionRatio) * 100).toFixed(2)}%`, 'reset');
      log(`  Compression time: ${compressTime}ms`, 'reset');
      log(`  Decompression time: ${decompressTime}ms`, 'reset');
      passed++;
    } else {
      throw new Error('Data mismatch after decompression');
    }
  } catch (error) {
    log(`✗ Test 2 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  console.log();

  // Test 3: Size Validation
  try {
    log('Test 3: Size Validation', 'blue');
    const service = new DataCompressionService();

    // Valid data
    const validData = [{ id: 1, name: 'Test' }];
    const validation1 = service.validateDataSize(validData);
    if (!validation1.valid) throw new Error('Valid data rejected');

    // Too many rows
    const tooManyRows = Array.from({ length: 10001 }, (_, i) => ({ id: i }));
    const validation2 = service.validateDataSize(tooManyRows);
    if (validation2.valid) throw new Error('Too many rows not rejected');

    // Empty array
    const validation3 = service.validateDataSize([]);
    if (!validation3.valid) throw new Error('Empty array rejected');

    log('✓ Size validation working correctly', 'green');
    log(`  Valid data: ${validation1.size} bytes`, 'reset');
    log(`  Too many rows: ${validation2.reason}`, 'reset');
    log(`  Empty array: accepted`, 'reset');
    passed++;
  } catch (error) {
    log(`✗ Test 3 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  console.log();

  // Test 4: Brotli Algorithm
  try {
    log('Test 4: Brotli Algorithm', 'blue');
    const service = new DataCompressionService({
      algorithm: CompressionAlgorithm.BROTLI,
      level: 11
    });

    const data = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      value: `Item ${i}`
    }));

    const compressed = await service.compress(data);
    const decompressed = await service.decompress(compressed.buffer);

    if (JSON.stringify(data) === JSON.stringify(decompressed)) {
      log('✓ Brotli compression successful', 'green');
      log(`  Algorithm: ${compressed.metadata.algorithm}`, 'reset');
      log(`  Original size: ${formatBytes(compressed.metadata.originalSize)}`, 'reset');
      log(`  Compressed size: ${formatBytes(compressed.metadata.compressedSize)}`, 'reset');
      log(`  Compression ratio: ${(compressed.metadata.compressionRatio * 100).toFixed(2)}%`, 'reset');
      passed++;
    } else {
      throw new Error('Data mismatch after decompression');
    }
  } catch (error) {
    log(`✗ Test 4 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  console.log();

  // Test 5: Algorithm Comparison
  try {
    log('Test 5: GZIP vs Brotli Comparison', 'blue');
    const data = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
    }));

    const gzipService = new DataCompressionService({
      algorithm: CompressionAlgorithm.GZIP,
      level: 9
    });
    const brotliService = new DataCompressionService({
      algorithm: CompressionAlgorithm.BROTLI,
      level: 11
    });

    const gzipResult = await gzipService.compress(data);
    const brotliResult = await brotliService.compress(data);

    log('✓ Algorithm comparison complete', 'green');
    log(`  GZIP:`, 'reset');
    log(`    Compressed size: ${formatBytes(gzipResult.metadata.compressedSize)}`, 'reset');
    log(`    Ratio: ${(gzipResult.metadata.compressionRatio * 100).toFixed(2)}%`, 'reset');
    log(`  Brotli:`, 'reset');
    log(`    Compressed size: ${formatBytes(brotliResult.metadata.compressedSize)}`, 'reset');
    log(`    Ratio: ${(brotliResult.metadata.compressionRatio * 100).toFixed(2)}%`, 'reset');

    const winner = brotliResult.metadata.compressionRatio < gzipResult.metadata.compressionRatio
      ? 'Brotli'
      : 'GZIP';
    log(`  Winner (better compression): ${winner}`, 'yellow');
    passed++;
  } catch (error) {
    log(`✗ Test 5 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  console.log();

  // Test 6: Error Handling
  try {
    log('Test 6: Error Handling', 'blue');
    const service = new DataCompressionService();

    let errorsCaught = 0;

    // Test invalid input
    try {
      await service.compress('not an array' as any);
    } catch (error) {
      if (error instanceof Error && error.message.includes('must be an array')) {
        errorsCaught++;
      }
    }

    // Test invalid buffer
    try {
      await service.decompress('not a buffer' as any);
    } catch (error) {
      if (error instanceof Error && error.message.includes('must be a Buffer')) {
        errorsCaught++;
      }
    }

    // Test empty buffer
    try {
      await service.decompress(Buffer.from([]));
    } catch (error) {
      if (error instanceof Error && error.message.includes('empty')) {
        errorsCaught++;
      }
    }

    // Test corrupted data
    try {
      await service.decompress(Buffer.from([1, 2, 3, 4, 5]));
    } catch (error) {
      if (error instanceof Error && error.message.includes('corrupted')) {
        errorsCaught++;
      }
    }

    if (errorsCaught === 4) {
      log('✓ Error handling working correctly', 'green');
      log(`  Caught ${errorsCaught}/4 expected errors`, 'reset');
      passed++;
    } else {
      throw new Error(`Only caught ${errorsCaught}/4 expected errors`);
    }
  } catch (error) {
    log(`✗ Test 6 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  console.log();

  // Test 7: Utility Functions
  try {
    log('Test 7: Utility Functions', 'blue');
    const data = [{ id: 1, test: 'data' }];

    // Test compressData utility
    const compressed = await compressData(data);
    if (!compressed.buffer || !compressed.metadata) {
      throw new Error('compressData failed');
    }

    // Test decompressData utility
    const decompressed = await decompressData(compressed.buffer);
    if (JSON.stringify(data) !== JSON.stringify(decompressed)) {
      throw new Error('decompressData failed');
    }

    log('✓ Utility functions working correctly', 'green');
    log(`  compressData: OK`, 'reset');
    log(`  decompressData: OK`, 'reset');
    passed++;
  } catch (error) {
    log(`✗ Test 7 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  console.log();

  // Test 8: Compression Ratio Calculation
  try {
    log('Test 8: Compression Metrics', 'blue');
    const service = new DataCompressionService();

    const ratio1 = service.getCompressionRatio(1000, 300);
    const ratio2 = service.getCompressionRatio(1000, 1000);

    const savings1 = service.getSpaceSavings(1000, 300);
    const savings2 = service.getSpaceSavings(1000, 1000);

    if (ratio1 === 0.3 && ratio2 === 1 && savings1 === 70 && savings2 === 0) {
      log('✓ Compression metrics working correctly', 'green');
      log(`  Ratio 1000→300: ${ratio1} (${savings1}% saved)`, 'reset');
      log(`  Ratio 1000→1000: ${ratio2} (${savings2}% saved)`, 'reset');
      passed++;
    } else {
      throw new Error('Metric calculations incorrect');
    }
  } catch (error) {
    log(`✗ Test 8 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  console.log();

  // Test 9: Real CSV Data Scenario
  try {
    log('Test 9: Real CSV Data Scenario', 'blue');
    const service = new DataCompressionService();

    // Simulate typical CSV data
    const csvData = Array.from({ length: 1000 }, (_, i) => ({
      ID: i + 1,
      Name: `Customer ${i + 1}`,
      Email: `customer${i + 1}@example.com`,
      Phone: `555-${String(i + 1).padStart(4, '0')}`,
      Address: `${i + 1} Main Street`,
      City: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'][i % 5],
      State: ['NY', 'CA', 'IL', 'TX', 'AZ'][i % 5],
      ZipCode: String(10000 + (i % 90000)),
      SignupDate: new Date(2024, i % 12, (i % 28) + 1).toISOString(),
      Status: ['Active', 'Inactive', 'Pending'][i % 3],
      PurchaseCount: Math.floor(Math.random() * 100),
      TotalSpent: (Math.random() * 10000).toFixed(2)
    }));

    const compressed = await service.compress(csvData);
    const decompressed = await service.decompress(compressed.buffer);

    if (JSON.stringify(csvData) === JSON.stringify(decompressed)) {
      log('✓ Real CSV data scenario successful', 'green');
      log(`  Rows: ${csvData.length}`, 'reset');
      log(`  Columns: ${Object.keys(csvData[0]).length}`, 'reset');
      log(`  Original size: ${formatBytes(compressed.metadata.originalSize)}`, 'reset');
      log(`  Compressed size: ${formatBytes(compressed.metadata.compressedSize)}`, 'reset');
      log(`  Space saved: ${((1 - compressed.metadata.compressionRatio) * 100).toFixed(2)}%`, 'reset');
      passed++;
    } else {
      throw new Error('Data mismatch after decompression');
    }
  } catch (error) {
    log(`✗ Test 9 failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  log('Test Summary', 'cyan');
  console.log('='.repeat(60));
  log(`Total Tests: ${passed + failed}`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, 'red');
  console.log('='.repeat(60) + '\n');

  if (failed === 0) {
    log('All tests passed! 🎉', 'green');
  } else {
    log(`${failed} test(s) failed. Please review the errors above.`, 'red');
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  log(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
  process.exit(1);
});
