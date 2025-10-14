# ProjectData Migration Quick Start

## 1. Run Migration

```bash
# Generate migration
npx prisma migrate dev --name add_project_data_model

# Or for production (no prompts)
npx prisma migrate deploy
```

## 2. Regenerate Prisma Client

```bash
npx prisma generate
```

## 3. Verify Migration

```bash
# Check migration status
npx prisma migrate status

# View database schema
npx prisma studio
```

## 4. Test Database Connection

Create `scripts/test-project-data.ts`:

```typescript
import { PrismaClient } from '@/lib/generated/prisma';
import { ProjectDataHelpers } from '@/lib/utils/project-data-helpers';

const prisma = new PrismaClient();

async function testProjectData() {
  console.log('Testing ProjectData schema...\n');

  // Sample data
  const sampleData = [
    { name: 'Product A', sales: 1000, region: 'North' },
    { name: 'Product B', sales: 1500, region: 'South' },
    { name: 'Product C', sales: 1200, region: 'East' },
  ];

  try {
    // 1. Create test project
    const project = await prisma.projects.create({
      data: {
        id: 'test-project-' + Date.now(),
        name: 'Test Project',
        description: 'Testing ProjectData schema',
        userId: 'test-user-id', // Replace with real user ID
      },
    });
    console.log('Created test project:', project.id);

    // 2. Prepare and store data
    const payload = await ProjectDataHelpers.prepareProjectDataPayload(
      project.id,
      sampleData,
      'test-data.csv',
      1024,
      'text/csv'
    );

    const projectData = await prisma.projectData.create({
      data: payload,
    });
    console.log('\nStored project data:', projectData.id);
    console.log('- Row count:', projectData.rowCount);
    console.log('- Compressed size:', payload.compressedData.length, 'bytes');
    console.log('- Quality score:', projectData.dataQualityScore);

    // 3. Retrieve and decompress
    const retrieved = await prisma.projectData.findUnique({
      where: { id: projectData.id },
      select: {
        id: true,
        compressedData: true,
        rowCount: true,
        columnNames: true,
      },
    });

    if (retrieved) {
      const decompressed = await ProjectDataHelpers.decompressData(
        retrieved.compressedData
      );
      console.log('\nDecompressed data:', decompressed);
    }

    // 4. Test preview (no decompression)
    const preview = await prisma.projectData.findUnique({
      where: { id: projectData.id },
      select: {
        id: true,
        rowCount: true,
        columnCount: true,
        columnNames: true,
        sampleData: true,
        dataQualityScore: true,
      },
    });

    if (preview) {
      console.log('\nPreview (no decompression):');
      console.log('- Columns:', JSON.parse(preview.columnNames));
      console.log('- Sample:', JSON.parse(preview.sampleData || '[]'));
    }

    // 5. Cleanup
    await prisma.projectData.delete({ where: { id: projectData.id } });
    await prisma.projects.delete({ where: { id: project.id } });
    console.log('\nTest completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testProjectData();
```

Run test:
```bash
npx ts-node scripts/test-project-data.ts
```

## 5. Expected Results

```
Testing ProjectData schema...

Created test project: test-project-1234567890

Stored project data: clx123abc456
- Row count: 3
- Compressed size: 145 bytes
- Quality score: 100

Decompressed data: [
  { name: 'Product A', sales: 1000, region: 'North' },
  { name: 'Product B', sales: 1500, region: 'South' },
  { name: 'Product C', sales: 1200, region: 'East' }
]

Preview (no decompression):
- Columns: [ 'name', 'sales', 'region' ]
- Sample: [
  { name: 'Product A', sales: 1000, region: 'North' },
  { name: 'Product B', sales: 1500, region: 'South' },
  { name: 'Product C', sales: 1200, region: 'East' }
]

Test completed successfully!
```

## 6. Integration Example

```typescript
// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@/lib/generated/prisma';
import { ProjectDataHelpers } from '@/lib/utils/project-data-helpers';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { projectId, data, fileName, fileSize, mimeType } = await req.json();

    // Validate
    const validation = ProjectDataHelpers.validateData(data);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid data', details: validation.errors },
        { status: 400 }
      );
    }

    // Check for duplicate (optional)
    const jsonData = JSON.stringify(data);
    const hash = ProjectDataHelpers.calculateHash(jsonData);
    const existing = await prisma.projectData.findFirst({
      where: { projectId, fileHash: hash, status: 'active' },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'Duplicate file already uploaded', id: existing.id },
        { status: 409 }
      );
    }

    // Store data
    const payload = await ProjectDataHelpers.prepareProjectDataPayload(
      projectId,
      data,
      fileName,
      fileSize,
      mimeType
    );

    const projectData = await prisma.projectData.create({
      data: payload,
    });

    return NextResponse.json({
      success: true,
      id: projectData.id,
      rowCount: projectData.rowCount,
      qualityScore: projectData.dataQualityScore,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to store data' },
      { status: 500 }
    );
  }
}
```

## 7. Monitoring Query

```sql
-- Check storage usage
SELECT
  COUNT(*) as total_datasets,
  SUM("rowCount") as total_rows,
  SUM("uncompressedSize") as total_uncompressed_bytes,
  SUM(LENGTH("compressedData")) as total_compressed_bytes,
  ROUND(AVG(LENGTH("compressedData")::numeric / "uncompressedSize" * 100), 2) as avg_compression_ratio,
  ROUND(AVG("dataQualityScore"), 2) as avg_quality_score
FROM project_data
WHERE "isActive" = true;
```

## 8. Rollback (If Needed)

```bash
# List migrations
npx prisma migrate status

# Mark as rolled back
npx prisma migrate resolve --rolled-back 20250111_add_project_data_model

# Manually drop table (if needed)
psql $DATABASE_URL -c "DROP TABLE project_data CASCADE;"
```

## Troubleshooting

### Error: "Column does not exist"
- Run `npx prisma generate` to update client
- Restart TypeScript server in VSCode

### Error: "Relation does not exist"
- Check migration applied: `npx prisma migrate status`
- Run migration: `npx prisma migrate deploy`

### Error: "Type Bytes is not assignable"
- Update Prisma client: `npm install @prisma/client@latest`
- Regenerate: `npx prisma generate`

## Next Steps

1. Update file upload flow to use new schema
2. Add Redis caching for decompressed data
3. Implement background archival job for old versions
4. Set up monitoring dashboard
5. Load test with 10K row datasets
