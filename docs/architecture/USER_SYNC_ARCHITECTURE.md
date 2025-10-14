# User Synchronization Architecture

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Firebase Authentication (Client SDK)                         │  │
│  │ - Email/Password Login                                       │  │
│  │ - Google OAuth                                               │  │
│  │ - Token Management                                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Auth Context (lib/contexts/auth-context.tsx)                 │  │
│  │ - Manages auth state                                         │  │
│  │ - onAuthStateChanged listener                                │  │
│  │ - Triggers syncUserAndMigrateProjects()                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ API Client (lib/utils/api-client.ts)                         │  │
│  │ - createAuthHeader()                                         │  │
│  │ - authenticatedFetch()                                       │  │
│  │ - syncUserToDatabase()                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
└────────────────────────────────────────────────────────────────────┘
                               ↓ HTTP POST
                               ↓ Authorization: Bearer <token>
┌────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Auth Middleware (lib/middleware/auth.ts)                     │  │
│  │ - withAuth() HOF                                             │  │
│  │ - extractFirebaseUser()                                      │  │
│  │ - Token verification (TODO: Firebase Admin SDK)              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ API Routes                                                    │  │
│  │                                                               │  │
│  │  POST /api/user/sync    - Sync user to database             │  │
│  │  GET /api/user          - Get user profile                  │  │
│  │  PATCH /api/user        - Update user profile               │  │
│  │  DELETE /api/user       - Delete user account               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ User Service (lib/api/user-service.ts)                       │  │
│  │                                                               │  │
│  │  • syncUser()                - Upsert user record            │  │
│  │  • getUserByFirebaseUid()    - Query by Firebase UID         │  │
│  │  • getUser()                 - Query by database ID          │  │
│  │  • updateUser()              - Update user data              │  │
│  │  • deleteUser()              - Delete user + cascade         │  │
│  │  • getUserWithSessions()     - Get user + relations          │  │
│  │  • migrateAnonymousSessions() - Migrate sessions             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Prisma ORM (lib/db.ts)                                       │  │
│  │ - Type-safe database client                                  │  │
│  │ - Query builder                                              │  │
│  │ - Migration management                                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Database Schema (prisma/schema.prisma)                       │  │
│  │                                                               │  │
│  │  User {                                                       │  │
│  │    id          String   @id @default(cuid())                 │  │
│  │    firebaseUid String?  @unique  ← Links to Firebase        │  │
│  │    email       String?                                       │  │
│  │    name        String?                                       │  │
│  │    photoURL    String?                                       │  │
│  │    sessions    Session[]  ← Relations                        │  │
│  │  }                                                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Postgres Database (SQLite in dev)                            │  │
│  │ - Persistent user records                                    │  │
│  │ - Relational data (sessions, projects, etc.)                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### 1. User Sign Up Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Enter email/password
     ↓
┌────────────────────────────┐
│ Firebase Auth (Client)     │
│ createUserWithEmailAndPwd  │
└────────┬───────────────────┘
         │ 2. Creates Firebase account
         ↓
┌────────────────────────────┐
│ Auth Context               │
│ onAuthStateChanged         │
└────────┬───────────────────┘
         │ 3. Triggers sync
         ↓
┌────────────────────────────┐
│ API Client                 │
│ syncUserToDatabase()       │
└────────┬───────────────────┘
         │ 4. POST /api/user/sync
         ↓         with Bearer token
┌────────────────────────────┐
│ Auth Middleware            │
│ Verifies token             │
└────────┬───────────────────┘
         │ 5. Extracts user
         ↓
┌────────────────────────────┐
│ User Service               │
│ syncUser() - UPSERT        │
└────────┬───────────────────┘
         │ 6. Creates user record
         ↓
┌────────────────────────────┐
│ Postgres Database          │
│ User table                 │
└────────┬───────────────────┘
         │ 7. Returns user data
         ↓
┌────────────────────────────┐
│ Client                     │
│ User synced!               │
└────────────────────────────┘
```

### 2. User Sign In Flow (Existing User)

```
User signs in
    ↓
Firebase validates credentials
    ↓
Auth Context receives user
    ↓
Triggers syncUserToDatabase()
    ↓
POST /api/user/sync
    ↓
User Service: UPSERT (UPDATE existing)
    ↓
Updates email, name, photoURL, updatedAt
    ↓
Returns updated user
```

### 3. User Profile Update Flow

```
User updates profile
    ↓
Client calls PATCH /api/user
    ↓
Auth Middleware validates
    ↓
User Service: updateUser()
    ↓
Prisma updates record
    ↓
Returns updated user
```

## Service Boundaries

### Client-Side Services

**Auth Context** (`lib/contexts/auth-context.tsx`)
- Manages authentication state
- Listens to Firebase auth changes
- Triggers automatic user sync
- Handles sign in/up/out operations

**API Client** (`lib/utils/api-client.ts`)
- Creates authentication headers
- Makes authenticated HTTP requests
- Handles API responses
- Client-side error handling

### Server-Side Services

**Auth Middleware** (`lib/middleware/auth.ts`)
- Protects API routes
- Verifies Firebase tokens
- Extracts user information
- Returns 401 for unauthorized requests

**User Service** (`lib/api/user-service.ts`)
- Business logic for user operations
- Database operations via Prisma
- Type-safe interfaces
- Error handling and logging

**API Routes** (`app/api/user/`)
- HTTP endpoint definitions
- Request/response handling
- Calls service layer
- Returns JSON responses

## Database Design

### User Table Schema

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,           -- cuid()
  firebaseUid TEXT UNIQUE,                -- Links to Firebase
  email       TEXT,                       -- User email
  name        TEXT,                       -- Display name
  photoURL    TEXT,                       -- Profile picture URL
  createdAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebaseUid);
CREATE INDEX idx_users_email ON users(email);
```

### Relationships

```
User (1) ──────< (Many) Session
  │
  └──────< (Many) Project (future)
```

### Cascade Deletion

When a user is deleted:
- All sessions are deleted (ON DELETE CASCADE)
- All projects are deleted (future)
- All associated data is removed

## API Design

### Endpoint Structure

```
/api/user/
  ├── sync/    POST   - Sync Firebase user to database
  ├── /        GET    - Get current user profile
  ├── /        PATCH  - Update user profile
  └── /        DELETE - Delete user account
```

### Authentication Flow

```
Client Request
    ↓
    Header: Authorization: Bearer <firebase-token>
    ↓
Auth Middleware
    ↓
    Validates token
    Extracts user: { uid, email, displayName, photoURL }
    ↓
Route Handler (withAuth)
    ↓
    Receives authenticated user
    Calls service layer
    ↓
Returns Response
```

### Error Handling

```
Client Error (4xx)
├── 400 Bad Request      - Invalid input
├── 401 Unauthorized     - Missing/invalid token
├── 403 Forbidden        - Insufficient permissions
└── 404 Not Found        - User not found

Server Error (5xx)
├── 500 Internal Error   - Database/unexpected errors
└── 503 Service Unavailable - Database down
```

## Security Architecture

### Current (Development)

```
Client
    ↓
    Creates base64-encoded token: btoa(JSON.stringify(user))
    ↓
Server
    ↓
    Decodes token: JSON.parse(atob(token))
    ↓
    Extracts user data
```

**Limitations:**
- Not cryptographically signed
- Can be easily forged
- Only suitable for development

### Production (TODO)

```
Client
    ↓
    Gets Firebase ID token: user.getIdToken()
    ↓
    Sends: Authorization: Bearer <id-token>
    ↓
Server (Firebase Admin SDK)
    ↓
    Verifies token: admin.auth().verifyIdToken(token)
    ↓
    Validates signature, expiration, claims
    ↓
    Returns decoded token with verified user data
```

**Benefits:**
- Cryptographically signed by Firebase
- Cannot be forged
- Auto-expires (1 hour)
- Includes custom claims

## Scaling Considerations

### Current Architecture (MVP)

**Limits:**
- Single database instance
- Synchronous operations
- No caching
- Direct database queries

**Suitable for:**
- < 1000 users
- < 100 requests/second
- Development and testing

### Horizontal Scaling Strategy

**1. Database Scaling**
```
Read Replicas
    ↓
Primary (writes) + Replicas (reads)
    ↓
Load balancer distributes reads
```

**2. Caching Layer**
```
Request
    ↓
Check Redis cache
    ↓
    Hit? Return cached data
    ↓
    Miss? Query database → Cache result
```

**3. API Rate Limiting**
```
Client → Rate Limiter → API
             ↓
         Track by user ID
         Limit: 100 req/min
```

**4. Async Operations**
```
POST /api/user/sync
    ↓
Return 202 Accepted
    ↓
Queue background job
    ↓
Process sync asynchronously
```

### Bottleneck Analysis

**Potential Bottlenecks:**

1. **Database Writes** (User sync on every auth)
   - Solution: Cache user data, sync only on changes
   - Solution: Batch updates every N minutes

2. **Token Verification** (On every API request)
   - Solution: Cache verified tokens (5-10 minutes)
   - Solution: Use JWT with short expiration

3. **API Route Latency** (Sequential operations)
   - Solution: Parallel database queries
   - Solution: Connection pooling

## Performance Optimization

### Database Indexes

```sql
-- Already indexed
CREATE UNIQUE INDEX idx_users_firebase_uid ON users(firebaseUid);

-- Recommended additions
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_updated_at ON users(updatedAt);
```

### Caching Strategy

```typescript
// User cache (in-memory)
const userCache = new Map<string, { user: UserData, expires: number }>()

function getCachedUser(firebaseUid: string): UserData | null {
  const cached = userCache.get(firebaseUid)
  if (cached && cached.expires > Date.now()) {
    return cached.user
  }
  return null
}
```

### Query Optimization

```typescript
// Good: Single query with relations
const user = await db.user.findUnique({
  where: { firebaseUid },
  include: { sessions: true }
})

// Bad: N+1 queries
const user = await db.user.findUnique({ where: { firebaseUid } })
const sessions = await db.session.findMany({ where: { userId: user.id } })
```

## Technology Stack

### Client-Side
- **React 18** - UI framework
- **Next.js 14** - App router, server components
- **Firebase SDK** - Client authentication
- **TypeScript** - Type safety

### Server-Side
- **Next.js API Routes** - REST endpoints
- **Prisma 5** - ORM
- **SQLite** (dev) / **Postgres** (prod) - Database
- **TypeScript** - Type safety

### Future Additions
- **Firebase Admin SDK** - Token verification
- **Redis** - Caching layer
- **Bull** - Job queue for async operations
- **Sentry** - Error monitoring

## Deployment Architecture

### Development

```
Local Machine
    ├── Next.js Dev Server (port 3000)
    ├── SQLite Database (file:./dev.db)
    └── Firebase Emulator (optional)
```

### Production

```
Vercel (or similar)
    ├── Next.js App (serverless functions)
    ├── Edge Network (CDN)
    └── Environment Variables
        ↓
Postgres Database (Vercel Postgres, Supabase, etc.)
        ↓
Firebase (Google Cloud)
```

## Monitoring & Observability

### Logging Strategy

```typescript
// Structured logging
console.log('[USER-SERVICE] Syncing user:', {
  firebaseUid,
  operation: 'sync',
  timestamp: new Date().toISOString()
})

// Error logging
console.error('[USER-SERVICE] Sync failed:', {
  firebaseUid,
  error: error.message,
  stack: error.stack
})
```

### Metrics to Track

1. **User Sync Success Rate**
   - Target: > 99.9%
   - Alert: < 95%

2. **API Response Time**
   - Target: < 200ms (p95)
   - Alert: > 1000ms

3. **Database Query Time**
   - Target: < 50ms (p95)
   - Alert: > 500ms

4. **Error Rate**
   - Target: < 0.1%
   - Alert: > 1%

### Health Checks

```typescript
// GET /api/health
{
  status: 'healthy',
  database: 'connected',
  firebase: 'configured',
  timestamp: '2025-10-10T12:00:00Z'
}
```

## Future Enhancements

### Phase 2: Enhanced Security
- [ ] Firebase Admin SDK integration
- [ ] Custom claims for role-based access
- [ ] Rate limiting per user
- [ ] IP-based rate limiting
- [ ] Audit logging

### Phase 3: Performance
- [ ] Redis caching layer
- [ ] Connection pooling
- [ ] Database read replicas
- [ ] Query optimization
- [ ] Background job processing

### Phase 4: Advanced Features
- [ ] User profile analytics
- [ ] Session management dashboard
- [ ] Bulk user operations
- [ ] User export (GDPR compliance)
- [ ] Multi-factor authentication support

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
