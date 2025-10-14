# Data Compression Service

Production-ready data compression service for efficient storage of CSV/Excel data in PostgreSQL.

## Overview

The Data Compression Service provides efficient compression and decompression of JSON data arrays using GZIP or Brotli algorithms. It's designed to handle large datasets (up to 10K rows, 50MB uncompressed) with proper error handling and validation.

## Features

- **Dual Algorithm Support**: GZIP and Brotli compression
- **Size Validation**: Automatic validation of data size constraints
- **Error Handling**: Comprehensive error handling and validation
- **Metadata Tracking**: Compression statistics and metadata
- **Type Safety**: Full TypeScript support with proper typing
- **Performance Optimized**: Uses Node.js built-in zlib for maximum performance

## Installation

The service is located at `/lib/services/data-compression.ts` and has no external dependencies (uses Node.js built-in modules).

## Usage

### Basic Usage with GZIP

```typescript
import { DataCompressionService, CompressionAlgorithm } from '@/lib/services/data-compression';

// Create service instance
const compressionService = new DataCompressionService();

// Prepare your CSV/Excel data
const csvData = [
  { Name: 'John Doe', Email: 'john@example.com', Age: 30, City: 'New York' },
  { Name: 'Jane Smith', Email: 'jane@example.com', Age: 25, City: 'Los Angeles' }
];

// Compress data
const compressed = await compressionService.compress(csvData);

console.log('Compression Stats:', {
  originalSize: compressed.metadata.originalSize,
  compressedSize: compressed.metadata.compressedSize,
  compressionRatio: compressed.metadata.compressionRatio,
  spaceSaved: `${((1 - compressed.metadata.compressionRatio) * 100).toFixed(2)}%`
});

// Store compressed buffer in PostgreSQL
// The buffer can be stored in a BYTEA column
const bufferToStore = compressed.buffer;

// Later, decompress the data
const decompressed = await compressionService.decompress(bufferToStore);
console.log('Decompressed data:', decompressed);
```

### Using Brotli Algorithm

```typescript
import { DataCompressionService, CompressionAlgorithm } from '@/lib/services/data-compression';

// Create service with Brotli algorithm
const brotliService = new DataCompressionService({
  algorithm: CompressionAlgorithm.BROTLI,
  level: 11 // Maximum compression
});

const data = [
  { id: 1, value: 'test' },
  { id: 2, value: 'another test' }
];

const compressed = await brotliService.compress(data);
const decompressed = await brotliService.decompress(compressed.buffer);
```

### Custom Compression Level

```typescript
// GZIP with custom level (1-9, default is 9)
const gzipFast = new DataCompressionService({
  algorithm: CompressionAlgorithm.GZIP,
  level: 6 // Faster compression, slightly larger size
});

// Brotli with custom level (0-11, default is 11)
const brotliFast = new DataCompressionService({
  algorithm: CompressionAlgorithm.BROTLI,
  level: 4 // Faster compression, slightly larger size
});
```

### Using Utility Functions

```typescript
import { compressData, decompressData, CompressionAlgorithm } from '@/lib/services/data-compression';

// Quick compression with defaults
const compressed = await compressData(myData);

// Quick decompression
const decompressed = await decompressData(compressed.buffer);

// With Brotli
const compressedBrotli = await compressData(myData, CompressionAlgorithm.BROTLI);
const decompressedBrotli = await decompressData(compressedBrotli.buffer, CompressionAlgorithm.BROTLI);
```

## Integration with Prisma/PostgreSQL

### Database Schema

```prisma
model DataSession {
  id              String   @id @default(cuid())
  userId          String
  compressedData  Bytes    // Store compressed buffer
  originalSize    Int      // Metadata
  compressedSize  Int      // Metadata
  compressionRatio Float   // Metadata
  algorithm       String   // "gzip" or "brotli"
  rowCount        Int
  createdAt       DateTime @default(now())

  @@index([userId])
}
```

### Storing Compressed Data

```typescript
import { PrismaClient } from '@prisma/client';
import { DataCompressionService } from '@/lib/services/data-compression';

const prisma = new PrismaClient();
const compressionService = new DataCompressionService();

async function storeCompressedData(userId: string, data: any[]) {
  // Compress the data
  const compressed = await compressionService.compress(data);

  // Store in database
  const session = await prisma.dataSession.create({
    data: {
      userId,
      compressedData: compressed.buffer,
      originalSize: compressed.metadata.originalSize,
      compressedSize: compressed.metadata.compressedSize,
      compressionRatio: compressed.metadata.compressionRatio,
      algorithm: compressed.metadata.algorithm,
      rowCount: data.length
    }
  });

  return session;
}
```

### Retrieving and Decompressing Data

```typescript
async function getDecompressedData(sessionId: string) {
  // Fetch from database
  const session = await prisma.dataSession.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Create compression service with correct algorithm
  const compressionService = new DataCompressionService({
    algorithm: session.algorithm as CompressionAlgorithm
  });

  // Decompress
  const data = await compressionService.decompress(session.compressedData);

  return {
    data,
    metadata: {
      originalSize: session.originalSize,
      compressedSize: session.compressedSize,
      compressionRatio: session.compressionRatio,
      rowCount: session.rowCount
    }
  };
}
```

## API Endpoint Integration

### Upload and Compress Endpoint

```typescript
// app/api/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DataCompressionService } from '@/lib/services/data-compression';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const compressionService = new DataCompressionService();

export async function POST(req: NextRequest) {
  try {
    const { userId, data } = await req.json();

    // Validate data size before compression
    const validation = compressionService.validateDataSize(data);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      );
    }

    // Compress data
    const compressed = await compressionService.compress(data);

    // Store in database
    const session = await prisma.dataSession.create({
      data: {
        userId,
        compressedData: compressed.buffer,
        originalSize: compressed.metadata.originalSize,
        compressedSize: compressed.metadata.compressedSize,
        compressionRatio: compressed.metadata.compressionRatio,
        algorithm: compressed.metadata.algorithm,
        rowCount: data.length
      }
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      metadata: {
        originalSize: compressed.metadata.originalSize,
        compressedSize: compressed.metadata.compressedSize,
        compressionRatio: compressed.metadata.compressionRatio,
        spaceSaved: `${((1 - compressed.metadata.compressionRatio) * 100).toFixed(2)}%`
      }
    });
  } catch (error) {
    console.error('Compression error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Compression failed' },
      { status: 500 }
    );
  }
}
```

### Retrieve and Decompress Endpoint

```typescript
// app/api/sessions/[id]/data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { DataCompressionService, CompressionAlgorithm } from '@/lib/services/data-compression';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id;

    // Fetch from database
    const session = await prisma.dataSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Create compression service with correct algorithm
    const compressionService = new DataCompressionService({
      algorithm: session.algorithm as CompressionAlgorithm
    });

    // Decompress data
    const data = await compressionService.decompress(session.compressedData);

    return NextResponse.json({
      success: true,
      data,
      metadata: {
        originalSize: session.originalSize,
        compressedSize: session.compressedSize,
        compressionRatio: session.compressionRatio,
        rowCount: session.rowCount,
        algorithm: session.algorithm
      }
    });
  } catch (error) {
    console.error('Decompression error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Decompression failed' },
      { status: 500 }
    );
  }
}
```

## Error Handling

The service provides comprehensive error handling:

```typescript
try {
  const compressed = await compressionService.compress(data);
} catch (error) {
  if (error instanceof Error) {
    // Handle specific errors
    if (error.message.includes('Data validation failed')) {
      // Handle validation errors
      console.error('Data too large or invalid:', error.message);
    } else if (error.message.includes('Compression failed')) {
      // Handle compression errors
      console.error('Compression error:', error.message);
    }
  }
}

try {
  const data = await compressionService.decompress(buffer);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('Data is corrupted')) {
      // Handle corrupted data
      console.error('Corrupted compressed data');
    } else if (error.message.includes('Invalid JSON')) {
      // Handle JSON parsing errors
      console.error('Invalid JSON after decompression');
    }
  }
}
```

## Validation

### Pre-compression Validation

```typescript
const compressionService = new DataCompressionService();

// Validate before compressing
const validation = compressionService.validateDataSize(myData);

if (!validation.valid) {
  console.error('Validation failed:', validation.reason);
  console.log('Data size:', validation.size);
} else {
  console.log('Data is valid:', {
    size: validation.size,
    sizeFormatted: formatBytes(validation.size)
  });

  // Proceed with compression
  const compressed = await compressionService.compress(myData);
}
```

### Size Estimation

```typescript
// Estimate compressed size before compression
const estimatedSize = compressionService.estimateCompressedSize(myData);
console.log('Estimated compressed size:', estimatedSize, 'bytes');

// Check if it's worth compressing
const validation = compressionService.validateDataSize(myData);
const estimatedRatio = estimatedSize / validation.size;

if (estimatedRatio > 0.9) {
  console.log('Low compression expected, consider alternative storage');
}
```

## Performance Considerations

### Algorithm Selection

**GZIP (default)**
- Faster compression/decompression
- Good compression ratio (70-80%)
- Lower CPU usage
- Best for: Real-time operations, frequent access

**Brotli**
- Better compression ratio (75-85%)
- Slower compression (but similar decompression speed)
- Higher CPU usage during compression
- Best for: Long-term storage, infrequent access

### Compression Level Trade-offs

```typescript
// Fast compression (level 1-3)
const fastService = new DataCompressionService({
  algorithm: CompressionAlgorithm.GZIP,
  level: 3
});
// Use when: Processing many files, speed is critical

// Balanced compression (level 4-6)
const balancedService = new DataCompressionService({
  algorithm: CompressionAlgorithm.GZIP,
  level: 6
});
// Use when: Normal operations, good balance

// Maximum compression (level 7-9)
const maxService = new DataCompressionService({
  algorithm: CompressionAlgorithm.GZIP,
  level: 9
});
// Use when: Storage cost is primary concern
```

## Constraints and Limits

- **Maximum uncompressed size**: 50MB
- **Maximum row count**: 10,000 rows
- **Target compression ratio**: 70-80% (varies by data type)
- **Supported data**: JSON-serializable arrays of objects

## Testing

Run tests with:

```bash
npm test lib/services/__tests__/data-compression.test.ts
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Application                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ Upload CSV/Excel Data
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   API Route Handler                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Validate data size                                │  │
│  │  2. Call DataCompressionService.compress()            │  │
│  │  3. Store compressed buffer in PostgreSQL             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│            DataCompressionService                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Algorithm: GZIP or Brotli                            │  │
│  │  - compress(): Array → Buffer                         │  │
│  │  - decompress(): Buffer → Array                       │  │
│  │  - validateDataSize(): Validation                     │  │
│  │  - getCompressionRatio(): number                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                PostgreSQL Database                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Table: DataSession                                   │  │
│  │  - compressedData: BYTEA (compressed buffer)          │  │
│  │  - originalSize: INT                                  │  │
│  │  - compressedSize: INT                                │  │
│  │  - compressionRatio: FLOAT                            │  │
│  │  - algorithm: VARCHAR                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

Retrieval Flow:
PostgreSQL → decompress(buffer) → Decompressed Array → Client
```

## Best Practices

1. **Always validate before compression**
   ```typescript
   const validation = service.validateDataSize(data);
   if (!validation.valid) {
     throw new Error(validation.reason);
   }
   ```

2. **Store algorithm with data**
   ```typescript
   // Store algorithm type to ensure correct decompression
   await db.save({ compressed: buffer, algorithm: 'gzip' });
   ```

3. **Handle errors gracefully**
   ```typescript
   try {
     const compressed = await service.compress(data);
   } catch (error) {
     // Log error and provide user feedback
     logger.error('Compression failed', { error, dataSize: data.length });
     throw new Error('Failed to process data');
   }
   ```

4. **Monitor compression ratios**
   ```typescript
   const result = await service.compress(data);
   if (result.metadata.compressionRatio > 0.9) {
     console.warn('Low compression ratio detected', {
       ratio: result.metadata.compressionRatio
     });
   }
   ```

5. **Use appropriate compression level**
   - Use level 6-7 for balanced performance
   - Use level 9 only when storage is critical
   - Use level 1-3 for real-time processing

## Troubleshooting

### Issue: Low compression ratio

**Cause**: Data is already compressed, encrypted, or highly random

**Solution**: Check data type, consider storing without compression if ratio > 0.9

### Issue: Decompression fails

**Cause**: Wrong algorithm, corrupted data, or data not compressed

**Solution**: Verify algorithm matches compression, check data integrity

### Issue: Out of memory

**Cause**: Data exceeds size limits

**Solution**: Validate data size before compression, implement chunking for very large datasets

## Migration Guide

If you're migrating from storing raw JSON to compressed data:

```typescript
// Before: Store raw JSON
await prisma.session.create({
  data: { jsonData: JSON.stringify(data) }
});

// After: Store compressed data
const compressionService = new DataCompressionService();
const compressed = await compressionService.compress(data);

await prisma.session.create({
  data: {
    compressedData: compressed.buffer,
    originalSize: compressed.metadata.originalSize,
    compressedSize: compressed.metadata.compressedSize,
    compressionRatio: compressed.metadata.compressionRatio,
    algorithm: compressed.metadata.algorithm
  }
});
```

## Support

For issues or questions:
1. Check error messages for specific guidance
2. Review validation results
3. Check data format and size constraints
4. Verify algorithm compatibility
