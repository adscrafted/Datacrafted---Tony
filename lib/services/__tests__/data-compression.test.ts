import {
  DataCompressionService,
  CompressionAlgorithm,
  createCompressionService,
  compressData,
  decompressData
} from '../data-compression';

describe('DataCompressionService', () => {
  describe('Initialization', () => {
    it('should initialize with default GZIP algorithm', () => {
      const service = new DataCompressionService();
      expect(service.getAlgorithm()).toBe(CompressionAlgorithm.GZIP);
    });

    it('should initialize with Brotli algorithm', () => {
      const service = new DataCompressionService({ algorithm: CompressionAlgorithm.BROTLI });
      expect(service.getAlgorithm()).toBe(CompressionAlgorithm.BROTLI);
    });

    it('should throw error for invalid GZIP level', () => {
      expect(() => {
        new DataCompressionService({ algorithm: CompressionAlgorithm.GZIP, level: 10 });
      }).toThrow('GZIP compression level must be between 1 and 9');
    });

    it('should throw error for invalid Brotli level', () => {
      expect(() => {
        new DataCompressionService({ algorithm: CompressionAlgorithm.BROTLI, level: 12 });
      }).toThrow('Brotli compression level must be between 0 and 11');
    });
  });

  describe('compress()', () => {
    it('should compress simple data array', async () => {
      const service = new DataCompressionService();
      const data = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 }
      ];

      const result = await service.compress(data);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata.originalSize).toBeGreaterThan(0);
      expect(result.metadata.compressedSize).toBeGreaterThan(0);
      expect(result.metadata.compressionRatio).toBeGreaterThan(0);
      expect(result.metadata.algorithm).toBe(CompressionAlgorithm.GZIP);
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
    });

    it('should compress large dataset', async () => {
      const service = new DataCompressionService();
      const data = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        age: Math.floor(Math.random() * 80) + 18,
        address: `${i} Main St, City ${i % 100}, State ${i % 50}`,
        phone: `555-${String(i).padStart(4, '0')}`,
        active: i % 2 === 0
      }));

      const result = await service.compress(data);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata.compressedSize).toBeLessThan(result.metadata.originalSize);
    });

    it('should throw error for non-array data', async () => {
      const service = new DataCompressionService();
      await expect(service.compress('not an array' as any)).rejects.toThrow('Data must be an array');
    });

    it('should throw error for oversized data', async () => {
      const service = new DataCompressionService();
      // Create data that exceeds 50MB
      const largeArray = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(1000) // 1KB per item = ~100MB total
      }));

      await expect(service.compress(largeArray)).rejects.toThrow('Data validation failed');
    });

    it('should compress with Brotli algorithm', async () => {
      const service = new DataCompressionService({ algorithm: CompressionAlgorithm.BROTLI });
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        value: `Item ${i}`
      }));

      const result = await service.compress(data);

      expect(result.metadata.algorithm).toBe(CompressionAlgorithm.BROTLI);
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('should handle empty array', async () => {
      const service = new DataCompressionService();
      const data: any[] = [];

      const result = await service.compress(data);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata.originalSize).toBe(2); // "[]"
    });
  });

  describe('decompress()', () => {
    it('should decompress data correctly', async () => {
      const service = new DataCompressionService();
      const originalData = [
        { id: 1, name: 'Alice', score: 95 },
        { id: 2, name: 'Bob', score: 87 },
        { id: 3, name: 'Charlie', score: 92 }
      ];

      const compressed = await service.compress(originalData);
      const decompressed = await service.decompress(compressed.buffer);

      expect(decompressed).toEqual(originalData);
    });

    it('should decompress large dataset correctly', async () => {
      const service = new DataCompressionService();
      const originalData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        timestamp: new Date().toISOString(),
        value: Math.random() * 1000,
        category: `Category ${i % 10}`
      }));

      const compressed = await service.compress(originalData);
      const decompressed = await service.decompress(compressed.buffer);

      expect(decompressed).toEqual(originalData);
      expect(decompressed.length).toBe(1000);
    });

    it('should decompress Brotli compressed data', async () => {
      const service = new DataCompressionService({ algorithm: CompressionAlgorithm.BROTLI });
      const originalData = [
        { id: 1, data: 'test' },
        { id: 2, data: 'another test' }
      ];

      const compressed = await service.compress(originalData);
      const decompressed = await service.decompress(compressed.buffer);

      expect(decompressed).toEqual(originalData);
    });

    it('should throw error for invalid buffer', async () => {
      const service = new DataCompressionService();
      await expect(service.decompress('not a buffer' as any)).rejects.toThrow('Input must be a Buffer');
    });

    it('should throw error for empty buffer', async () => {
      const service = new DataCompressionService();
      await expect(service.decompress(Buffer.from([]))).rejects.toThrow('Buffer is empty');
    });

    it('should throw error for corrupted data', async () => {
      const service = new DataCompressionService();
      const corruptedBuffer = Buffer.from([1, 2, 3, 4, 5]);

      await expect(service.decompress(corruptedBuffer)).rejects.toThrow('Data is corrupted');
    });

    it('should handle empty array decompression', async () => {
      const service = new DataCompressionService();
      const compressed = await service.compress([]);
      const decompressed = await service.decompress(compressed.buffer);

      expect(decompressed).toEqual([]);
    });
  });

  describe('getCompressionRatio()', () => {
    it('should calculate compression ratio correctly', () => {
      const service = new DataCompressionService();
      const ratio = service.getCompressionRatio(1000, 300);
      expect(ratio).toBe(0.3);
    });

    it('should return 1 for no compression', () => {
      const service = new DataCompressionService();
      const ratio = service.getCompressionRatio(1000, 1000);
      expect(ratio).toBe(1);
    });

    it('should throw error for zero original size', () => {
      const service = new DataCompressionService();
      expect(() => service.getCompressionRatio(0, 100)).toThrow('Original size cannot be zero');
    });

    it('should throw error for negative sizes', () => {
      const service = new DataCompressionService();
      expect(() => service.getCompressionRatio(-100, 50)).toThrow('Sizes must be non-negative');
      expect(() => service.getCompressionRatio(100, -50)).toThrow('Sizes must be non-negative');
    });
  });

  describe('getSpaceSavings()', () => {
    it('should calculate space savings correctly', () => {
      const service = new DataCompressionService();
      const savings = service.getSpaceSavings(1000, 300);
      expect(savings).toBe(70); // 70% savings
    });

    it('should return 0 for no compression', () => {
      const service = new DataCompressionService();
      const savings = service.getSpaceSavings(1000, 1000);
      expect(savings).toBe(0);
    });

    it('should return negative for expansion', () => {
      const service = new DataCompressionService();
      const savings = service.getSpaceSavings(1000, 1200);
      expect(savings).toBe(-20); // -20% (data expanded)
    });
  });

  describe('validateDataSize()', () => {
    it('should validate normal data', () => {
      const service = new DataCompressionService();
      const data = [{ id: 1, name: 'Test' }];
      const result = service.validateDataSize(data);

      expect(result.valid).toBe(true);
      expect(result.size).toBeGreaterThan(0);
      expect(result.reason).toBeUndefined();
    });

    it('should reject non-array data', () => {
      const service = new DataCompressionService();
      const result = service.validateDataSize('not an array' as any);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Data must be an array');
    });

    it('should reject data exceeding max rows', () => {
      const service = new DataCompressionService();
      const data = Array.from({ length: 10001 }, (_, i) => ({ id: i }));
      const result = service.validateDataSize(data);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds maximum of 10000');
    });

    it('should reject data exceeding max size', () => {
      const service = new DataCompressionService();
      const data = Array.from({ length: 5000 }, (_, i) => ({
        id: i,
        largeField: 'x'.repeat(15000) // ~75MB total
      }));
      const result = service.validateDataSize(data);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('exceeds maximum');
    });

    it('should accept empty array', () => {
      const service = new DataCompressionService();
      const result = service.validateDataSize([]);

      expect(result.valid).toBe(true);
      expect(result.size).toBe(0);
    });
  });

  describe('estimateCompressedSize()', () => {
    it('should estimate compressed size', () => {
      const service = new DataCompressionService();
      const data = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
      }));

      const estimate = service.estimateCompressedSize(data);
      expect(estimate).toBeGreaterThan(0);
    });

    it('should throw error for invalid data', () => {
      const service = new DataCompressionService();
      const data = Array.from({ length: 10001 }, (_, i) => ({ id: i }));

      expect(() => service.estimateCompressedSize(data)).toThrow('Cannot estimate size');
    });
  });

  describe('Static methods', () => {
    it('should return max uncompressed size', () => {
      const maxSize = DataCompressionService.getMaxUncompressedSize();
      expect(maxSize).toBe(50 * 1024 * 1024); // 50MB
    });

    it('should return max rows', () => {
      const maxRows = DataCompressionService.getMaxRows();
      expect(maxRows).toBe(10000);
    });
  });

  describe('Factory functions', () => {
    it('should create service with factory function', () => {
      const service = createCompressionService();
      expect(service).toBeInstanceOf(DataCompressionService);
    });

    it('should compress with utility function', async () => {
      const data = [{ id: 1, test: 'data' }];
      const result = await compressData(data);

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.metadata.algorithm).toBe(CompressionAlgorithm.GZIP);
    });

    it('should decompress with utility function', async () => {
      const originalData = [{ id: 1, test: 'data' }];
      const compressed = await compressData(originalData);
      const decompressed = await decompressData(compressed.buffer);

      expect(decompressed).toEqual(originalData);
    });

    it('should compress with Brotli using utility function', async () => {
      const data = [{ id: 1, test: 'data' }];
      const result = await compressData(data, CompressionAlgorithm.BROTLI);

      expect(result.metadata.algorithm).toBe(CompressionAlgorithm.BROTLI);
    });
  });

  describe('Real-world CSV/Excel data scenarios', () => {
    it('should handle typical CSV data structure', async () => {
      const service = new DataCompressionService();
      const csvData = [
        { Name: 'John Doe', Email: 'john@example.com', Age: '30', City: 'New York' },
        { Name: 'Jane Smith', Email: 'jane@example.com', Age: '25', City: 'Los Angeles' },
        { Name: 'Bob Johnson', Email: 'bob@example.com', Age: '35', City: 'Chicago' }
      ];

      const result = await service.compress(csvData);
      const decompressed = await service.decompress(result.buffer);

      expect(decompressed).toEqual(csvData);
      expect(result.metadata.compressionRatio).toBeLessThan(1);
    });

    it('should handle Excel data with mixed types', async () => {
      const service = new DataCompressionService();
      const excelData = [
        { ID: 1, Name: 'Product A', Price: 29.99, InStock: true, LastUpdated: '2025-01-15' },
        { ID: 2, Name: 'Product B', Price: 49.99, InStock: false, LastUpdated: '2025-01-14' },
        { ID: 3, Name: 'Product C', Price: 19.99, InStock: true, LastUpdated: '2025-01-13' }
      ];

      const result = await service.compress(excelData);
      const decompressed = await service.decompress(result.buffer);

      expect(decompressed).toEqual(excelData);
    });

    it('should achieve target compression ratio on repetitive data', async () => {
      const service = new DataCompressionService();
      // Repetitive data compresses better
      const repetitiveData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        status: 'Active',
        category: 'Standard',
        type: 'Regular',
        region: 'North America'
      }));

      const result = await service.compress(repetitiveData);

      // Should achieve 70-80% compression ratio or better
      expect(result.metadata.compressionRatio).toBeLessThan(0.8);
    });
  });

  describe('Compression algorithm comparison', () => {
    it('should compare GZIP and Brotli compression', async () => {
      const data = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'
      }));

      const gzipService = new DataCompressionService({ algorithm: CompressionAlgorithm.GZIP });
      const brotliService = new DataCompressionService({ algorithm: CompressionAlgorithm.BROTLI });

      const gzipResult = await gzipService.compress(data);
      const brotliResult = await brotliService.compress(data);

      // Both should compress the data
      expect(gzipResult.metadata.compressedSize).toBeLessThan(gzipResult.metadata.originalSize);
      expect(brotliResult.metadata.compressedSize).toBeLessThan(brotliResult.metadata.originalSize);

      // Verify both can decompress correctly
      const gzipDecompressed = await gzipService.decompress(gzipResult.buffer);
      const brotliDecompressed = await brotliService.decompress(brotliResult.buffer);

      expect(gzipDecompressed).toEqual(data);
      expect(brotliDecompressed).toEqual(data);
    });
  });
});
