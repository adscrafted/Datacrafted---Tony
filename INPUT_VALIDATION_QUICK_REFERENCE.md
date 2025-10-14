# Input Validation & Error Handling - Quick Reference

## Quick Start

### 1. Add Validation to an API Route

```typescript
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { someSchema } from '@/lib/validation/schemas'
import { successResponse, errorResponse } from '@/lib/utils/api-response'

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validatedData = someSchema.parse(body)

    // Use validated data
    const result = await doSomething(validatedData)

    // Return success
    return successResponse(result)

  } catch (error) {
    // Automatically handles Zod validation errors
    return errorResponse(error, 'Operation failed')
  }
}
```

### 2. Common Validation Schemas

```typescript
import {
  analyzeRequestSchema,
  createProjectSchema,
  updateProjectSchema,
  chatMessageSchema,
  signUpSchema,
  fileUploadSchema
} from '@/lib/validation/schemas'

// Validate analyze request
const data = analyzeRequestSchema.parse(body)

// Validate project creation
const project = createProjectSchema.parse(body)

// Validate chat message
const message = chatMessageSchema.parse(body)
```

### 3. Return Standardized Responses

```typescript
import {
  successResponse,      // 200 OK
  createdResponse,      // 201 Created
  acceptedResponse,     // 202 Accepted
  noContentResponse,    // 204 No Content
  errorResponse,        // Auto-detect error type
  paginatedResponse    // 200 with pagination
} from '@/lib/utils/api-response'

// Success with data
return successResponse({ id: 123, name: 'Test' })

// Created resource with location header
return createdResponse(newProject, `/api/projects/${newProject.id}`)

// Accepted for async processing
return acceptedResponse('Processing started', jobId)

// No content (successful delete)
return noContentResponse()

// Paginated results
return paginatedResponse(items, {
  page: 1,
  limit: 20,
  total: 100,
  totalPages: 5
})
```

### 4. Throw Custom Errors

```typescript
import {
  ValidationError,           // 400
  AuthenticationError,       // 401
  AuthorizationError,        // 403
  NotFoundError,            // 404
  ConflictError,            // 409
  RateLimitError,           // 429
  InternalServerError,      // 500
  ServiceUnavailableError   // 503
} from '@/lib/utils/api-response'

// Not found
if (!project) {
  throw new NotFoundError('Project')
}

// Unauthorized access
if (!canAccess) {
  throw new AuthorizationError('You cannot access this resource')
}

// Conflict (duplicate)
if (exists) {
  throw new ConflictError('Project with this name already exists')
}

// Errors are automatically caught and formatted by errorResponse()
```

## Available Validation Schemas

### Analyze API
```typescript
import { analyzeRequestSchema } from '@/lib/validation/schemas'

// Validates:
// - data: array of objects (1-100,000 rows)
// - schema: optional data schema
// - correctedSchema: optional user corrections
// - feedback: optional string (max 1000 chars)
// - fileName: optional string (max 255 chars)
```

### Projects
```typescript
import {
  createProjectSchema,
  updateProjectSchema,
  saveProjectDataSchema
} from '@/lib/validation/schemas'

// Create project
const project = createProjectSchema.parse({
  name: 'My Project',        // Required, 1-100 chars
  description: 'Desc',       // Optional, max 500 chars
  userId: 'user123',         // Required
  tags: ['tag1']            // Optional array
})

// Update project (all fields optional)
const updates = updateProjectSchema.parse({
  name: 'New Name',
  description: 'New description'
})

// Save project data
const dataToSave = saveProjectDataSchema.parse({
  data: [...],              // Required, 1-100,000 rows
  analysis: {...},          // Optional
  metadata: {
    fileName: 'data.csv',   // Required
    fileSize: 1024,         // Required, positive number
    mimeType: 'text/csv'    // Required
  }
})
```

### Dashboard Config
```typescript
import {
  dashboardConfigSchema,
  saveDashboardConfigSchema
} from '@/lib/validation/schemas'

const config = dashboardConfigSchema.parse({
  chartCustomizations: {...},
  currentTheme: 'light',
  currentLayout: {...},
  dashboardFilters: {...}
})
```

### Authentication
```typescript
import { signUpSchema, signInSchema } from '@/lib/validation/schemas'

// Sign up
const signUpData = signUpSchema.parse({
  email: 'user@example.com',
  password: 'SecurePass123',   // 8-128 chars
  displayName: 'John Doe'      // Optional
})

// Sign in
const signInData = signInSchema.parse({
  email: 'user@example.com',
  password: 'SecurePass123'
})
```

### File Upload
```typescript
import { fileUploadSchema } from '@/lib/validation/schemas'

const upload = fileUploadSchema.parse({
  file: file,                           // File object
  fileName: 'data.csv',                // Required
  fileSize: 1024000,                   // Max 50MB
  mimeType: 'text/csv'                 // CSV, Excel, or JSON only
})
```

### Common Patterns
```typescript
import {
  paginationSchema,
  uuidSchema,
  projectIdParamSchema,
  sessionIdParamSchema
} from '@/lib/validation/schemas'

// Pagination
const pagination = paginationSchema.parse({
  page: 1,                    // Default: 1
  limit: 20,                  // Default: 20, max: 100
  sortBy: 'createdAt',       // Optional
  sortOrder: 'desc'          // Optional: 'asc' | 'desc'
})

// UUID validation
const id = uuidSchema.parse('123e4567-e89b-12d3-a456-426614174000')

// Path params
const params = projectIdParamSchema.parse({ id: uuid })
```

## Error Handling Patterns

### Pattern 1: Try-Catch with errorResponse
```typescript
try {
  const data = schema.parse(body)
  const result = await process(data)
  return successResponse(result)
} catch (error) {
  return errorResponse(error, 'Failed to process request')
}
```

### Pattern 2: Safe Parse
```typescript
const result = schema.safeParse(body)

if (!result.success) {
  return NextResponse.json({
    error: 'Validation failed',
    details: result.error.errors
  }, { status: 400 })
}

// Use result.data
```

### Pattern 3: Custom Error with Details
```typescript
try {
  // ... operation ...
} catch (error) {
  if (error instanceof PrismaError) {
    return errorResponse(
      new InternalServerError('Database operation failed', {
        code: error.code,
        table: error.meta?.table
      })
    )
  }
  return errorResponse(error)
}
```

## Response Format Examples

### Success (200)
```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Project Name"
  }
}
```

### Created (201)
```json
{
  "success": true,
  "data": {
    "id": 456,
    "name": "New Project"
  }
}
// Headers: Location: /api/projects/456
```

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "errorType": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address",
      "code": "invalid_string"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters",
      "code": "too_small"
    }
  ]
}
```

### Authentication Error (401)
```json
{
  "success": false,
  "error": "Authentication required",
  "errorType": "AUTHENTICATION_ERROR"
}
```

### Authorization Error (403)
```json
{
  "success": false,
  "error": "Insufficient permissions",
  "errorType": "AUTHORIZATION_ERROR",
  "details": "You cannot access this resource"
}
```

### Not Found (404)
```json
{
  "success": false,
  "error": "Project not found",
  "errorType": "NOT_FOUND_ERROR"
}
```

### Rate Limit (429)
```json
{
  "success": false,
  "error": "Too Many Requests",
  "errorType": "RATE_LIMIT_ERROR",
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "limit": 10,
  "resetAt": "2025-10-14T15:30:00.000Z"
}
// Headers:
// X-RateLimit-Limit: 10
// X-RateLimit-Remaining: 0
// X-RateLimit-Reset: 1697295000
// Retry-After: 45
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error",
  "errorType": "INTERNAL_SERVER_ERROR"
  // Stack trace only in development
}
```

## Environment Validation

### Usage in layout.tsx
```typescript
import { validateEnvironment } from '@/lib/config/env-validation'

// Server-side only
if (typeof window === 'undefined') {
  validateEnvironment()
}

export default function RootLayout({ children }) {
  return <html>{children}</html>
}
```

### Required Environment Variables
```bash
# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123:web:abc

# Firebase Admin
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# OpenAI
OPENAI_API_KEY=sk-...

# App
NODE_ENV=development
NEXT_PUBLIC_DEBUG_MODE=false
```

### Validation Behavior
- **Development**: Throws error with detailed messages, continues running
- **Production**: Exits process (code 1) if validation fails
- **Auto-checks**: Warns if debug mode enabled in production
- **Redis**: Recommends Redis for production deployments

## Helper Utilities

### Format Zod Errors
```typescript
import { formatValidationErrors } from '@/lib/validation/schemas'

try {
  schema.parse(data)
} catch (error) {
  if (error instanceof z.ZodError) {
    const formatted = formatValidationErrors(error)
    // Returns: [{ field: 'email', message: 'Invalid email' }, ...]
  }
}
```

### Safe Validation
```typescript
import { validateDataSafe } from '@/lib/validation/schemas'

const result = validateDataSafe(schema, data)

if (result.success) {
  console.log(result.data)  // Type-safe validated data
} else {
  console.error(result.error)  // ZodError
}
```

### Logging
```typescript
import { logger } from '@/lib/utils/api-response'

logger.debug('Debug message')       // Development only
logger.info('Info message')          // Always
logger.warn('Warning message')       // Always
logger.error('Error message', error) // Always
```

## Testing Examples

### Test Validation Failure
```typescript
import { analyzeRequestSchema } from '@/lib/validation/schemas'

expect(() => {
  analyzeRequestSchema.parse({
    data: []  // Too small
  })
}).toThrow()
```

### Test Error Response
```typescript
import { errorResponse, ValidationError } from '@/lib/utils/api-response'

const response = errorResponse(
  new ValidationError('Invalid input'),
  'Validation failed'
)

expect(response.status).toBe(400)
const body = await response.json()
expect(body.success).toBe(false)
expect(body.errorType).toBe('VALIDATION_ERROR')
```

### Test Rate Limit Headers
```typescript
const response = await fetch('/api/analyze', {
  method: 'POST',
  body: JSON.stringify(data)
})

expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy()
expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy()
```

## Migration Checklist

- [ ] Import validation schema for your route
- [ ] Import error response utilities
- [ ] Add try-catch block around request handling
- [ ] Parse and validate request body with schema
- [ ] Replace manual error responses with utilities
- [ ] Replace manual success responses with successResponse()
- [ ] Add environment validation to layout.tsx
- [ ] Test with valid and invalid inputs
- [ ] Verify error messages are user-friendly
- [ ] Check that rate limit headers are present

## Common Issues

### Issue: "schema is not defined"
**Solution**: Import the correct schema from `@/lib/validation/schemas`

### Issue: Validation passes but TypeScript errors
**Solution**: Use type inference: `type MyData = z.infer<typeof mySchema>`

### Issue: Error response not showing details
**Solution**: Zod errors are auto-formatted. Custom errors need explicit details:
```typescript
throw new ValidationError('Message', { customDetails: 'here' })
```

### Issue: Environment validation fails in development
**Solution**: Copy `.env.example` to `.env.local` and fill in all required values

### Issue: Rate limit not working across instances
**Solution**: Configure Redis (Upstash) for shared rate limit store in production
