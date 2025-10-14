# DataCrafted Security Architecture

## Authentication & Authorization Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. Sign In Request
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Auth                             │
│                                                              │
│  • Email/Password Authentication                            │
│  • Google OAuth                                             │
│  • Token Generation (JWT)                                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ 2. ID Token (JWT)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                        Client                                 │
│                                                               │
│  • Stores token in memory (NOT localStorage)                │
│  • Includes token in Authorization header                   │
│  • Authorization: Bearer <token>                            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ 3. API Request + Token
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   Next.js Middleware                          │
│                   (middleware.ts)                             │
│                                                               │
│  ✓ Route Protection (before page render)                    │
│  ✓ Public route detection                                   │
│  ✓ Session cookie check                                     │
│  ✓ Debug mode check (development only)                      │
│  ✓ Redirect to / if unauthorized                            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ 4. Protected Route Access
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    API Route Handler                          │
│                                                               │
│  Layer 1: withRateLimit Middleware                          │
│  ├─ Check client IP                                          │
│  ├─ Verify request count                                     │
│  └─ Return 429 if limit exceeded                            │
│                                                               │
│  Layer 2: withAuth Middleware                               │
│  ├─ Extract Bearer token                                     │
│  ├─ Call requireAuth()                                       │
│  └─ Verify custom claims (if required)                      │
│                                                               │
│  Layer 3: Authorization Check                               │
│  ├─ Verify resource ownership                                │
│  ├─ Check user has permission                                │
│  └─ Return 403 if unauthorized                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ 5. Token Verification
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│              Firebase Admin SDK                               │
│              (lib/auth/server.ts)                             │
│                                                               │
│  • Verify JWT signature                                      │
│  • Check token expiration                                    │
│  • Verify token not revoked                                  │
│  • Extract user claims (uid, email, etc.)                    │
│  • Return AuthUser object                                    │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           │ 6. Authenticated User
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  Database Operations                          │
│                                                               │
│  • User ID from token (NOT request body)                    │
│  • Filter queries by userId                                  │
│  • Cascade deletes on user deletion                          │
│  • Audit logging                                             │
└──────────────────────────────────────────────────────────────┘
```

## Request Flow Example: Fetching User Sessions

```
GET /api/sessions
Authorization: Bearer eyJhbGciOi...

├─ [Rate Limiting]
│  ├─ Extract IP: 192.168.1.100
│  ├─ Check Redis: 28/30 requests
│  ├─ Increment counter: 29/30
│  └─ Add headers: X-RateLimit-Remaining: 1
│
├─ [Authentication]
│  ├─ Extract token from header
│  ├─ Verify with Firebase Admin SDK
│  ├─ Token valid: uid=user123
│  └─ Create AuthUser object
│
├─ [Authorization]
│  ├─ Get sessions WHERE userId=user123
│  ├─ User owns all returned sessions ✓
│  └─ Filter sensitive fields
│
└─ [Response]
   ├─ Status: 200 OK
   ├─ Headers: X-RateLimit-*
   └─ Body: { sessions: [...] }
```

## Security Layers Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    Layer 1: Network Security                    │
│                                                                 │
│  • HTTPS/TLS 1.3 only                                          │
│  • Strict-Transport-Security header                            │
│  • Certificate pinning (mobile apps)                           │
│  • DDoS protection (Vercel/Cloudflare)                         │
└────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                Layer 2: Application Security Headers            │
│                                                                 │
│  • Content-Security-Policy                                     │
│  • X-Frame-Options: DENY                                       │
│  • X-Content-Type-Options: nosniff                             │
│  • Referrer-Policy                                             │
│  • Permissions-Policy                                          │
└────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                    Layer 3: Rate Limiting                       │
│                                                                 │
│  • Redis-backed rate limiting                                  │
│  • IP-based tracking                                           │
│  • Different limits per endpoint type                          │
│  • 429 responses with Retry-After                             │
└────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                   Layer 4: Authentication                       │
│                                                                 │
│  • Firebase JWT verification                                   │
│  • Token expiration checks                                     │
│  • Token revocation checks                                     │
│  • Debug mode safeguards                                       │
└────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                    Layer 5: Authorization                       │
│                                                                 │
│  • Resource ownership verification                             │
│  • Role-based access control (RBAC)                           │
│  • Custom claims validation                                    │
│  • Least privilege principle                                   │
└────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                   Layer 6: Input Validation                     │
│                                                                 │
│  • Zod schema validation                                       │
│  • Size limits (50MB max)                                      │
│  • Type checking                                               │
│  • Sanitization                                                │
└────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                  Layer 7: Data Security                         │
│                                                                 │
│  • Encryption at rest (database)                               │
│  • Encryption in transit (TLS)                                 │
│  • Data compression (gzip)                                     │
│  • Parameterized queries (Prisma)                              │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow Security

### Upload & Analysis Flow

```
Client                  API Route              Processing           Database
  │                        │                       │                   │
  │ 1. Upload File         │                       │                   │
  ├────────────────────────>                       │                   │
  │                        │                       │                   │
  │                        │ 2. Validate Auth     │                   │
  │                        ├──────────────────────>│                   │
  │                        │                       │                   │
  │                        │ 3. Validate Input    │                   │
  │                        │    (size, format)    │                   │
  │                        │                       │                   │
  │                        │ 4. Compress Data     │                   │
  │                        ├──────────────────────>│                   │
  │                        │                       │                   │
  │                        │ 5. Calculate Hash    │                   │
  │                        │    (deduplication)   │                   │
  │                        │                       │                   │
  │                        │ 6. Store Compressed  │                   │
  │                        ├───────────────────────────────────────────>
  │                        │                       │                   │
  │                        │                       │ 7. Data stored    │
  │                        │                       │    with user_id   │
  │                        │                       │                   │
  │                        │ 8. AI Analysis       │                   │
  │                        ├──────────────────────>│                   │
  │                        │    (OpenAI API)      │                   │
  │                        │                       │                   │
  │ 9. Return Results      │                       │                   │
  │<────────────────────────                       │                   │
  │                        │                       │                   │
```

### Data Retrieval Flow

```
Client                  API Route              Database
  │                        │                       │
  │ 1. GET /api/           │                       │
  │    projects/:id/data   │                       │
  ├────────────────────────>                       │
  │                        │                       │
  │                        │ 2. Auth Check        │
  │                        │    (token verify)    │
  │                        │                       │
  │                        │ 3. Get User from DB  │
  │                        ├──────────────────────>│
  │                        │                       │
  │                        │ 4. Verify Project    │
  │                        │    Ownership         │
  │                        ├──────────────────────>│
  │                        │                       │
  │                        │ 5. Query Data        │
  │                        │    WHERE userId=X    │
  │                        ├──────────────────────>│
  │                        │                       │
  │                        │ 6. Decompress Data   │
  │                        │    (if full data)    │
  │                        │                       │
  │ 7. Return Data         │                       │
  │<────────────────────────                       │
  │                        │                       │
```

## Critical Security Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY 1                          │
│                 (Client ←→ Server)                          │
│                                                              │
│  Controls:                                                   │
│  • HTTPS/TLS encryption                                     │
│  • CORS headers                                             │
│  • CSP headers                                              │
│  • No sensitive data in client                              │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY 2                          │
│              (API Routes ←→ External Services)              │
│                                                              │
│  Controls:                                                   │
│  • API key authentication                                   │
│  • Timeout configuration                                    │
│  • Rate limiting                                            │
│  • Error handling                                           │
│                                                              │
│  Services:                                                   │
│  • Firebase Auth (token verification)                       │
│  • OpenAI API (data analysis)                              │
│  • Redis/KV (rate limiting)                                │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRUST BOUNDARY 3                          │
│                (Application ←→ Database)                    │
│                                                              │
│  Controls:                                                   │
│  • Parameterized queries (Prisma)                           │
│  • Connection pooling                                        │
│  • SSL/TLS for connections                                  │
│  • User-scoped queries (WHERE userId=X)                     │
│  • Cascade deletes                                          │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoint Protection Matrix

| Endpoint | Auth Required | Rate Limit | Authorization Check | Input Validation |
|----------|--------------|------------|---------------------|------------------|
| `POST /api/analyze` | ✅ Yes | 10/hour | N/A | ✅ Yes |
| `GET /api/sessions` | ✅ Yes | 30/min | User owns sessions | ❌ **Missing** |
| `POST /api/sessions` | ✅ Yes | 30/min | N/A | ❌ **Missing** |
| `GET /api/sessions/:id` | ✅ Yes | 30/min | ✅ Ownership | N/A |
| `PATCH /api/sessions/:id` | ✅ Yes | 30/min | ✅ Ownership | ❌ **Missing** |
| `DELETE /api/sessions/:id` | ✅ Yes | 30/min | ✅ Ownership | N/A |
| `GET /api/projects` | ✅ Yes | 30/min | User owns projects | N/A |
| `POST /api/projects` | ✅ Yes | 30/min | N/A | ❌ **Missing** |
| `GET /api/projects/:id/data` | ✅ Yes | 30/min | ✅ Ownership | N/A |
| `POST /api/projects/:id/data` | ✅ Yes | 10/hour | ✅ Ownership | ✅ Yes |
| `DELETE /api/projects/:id/data` | ✅ Yes | 30/min | ✅ Ownership | ✅ Yes |
| `POST /api/admin/cleanup` | ❌ **CRITICAL** | ❌ **Missing** | ❌ **Missing** | N/A |
| `GET /api/admin/cleanup` | ❌ **CRITICAL** | ❌ **Missing** | ❌ **Missing** | N/A |
| `GET /api/debug-*` | ❌ **HIGH** | ❌ **Missing** | ❌ **Missing** | N/A |
| `GET /api/health` | ✅ Public | ✅ 100/min | N/A | N/A |

**Legend:**
- ✅ Implemented correctly
- ❌ Missing or insufficient
- N/A Not applicable

## Security Incident Response Flow

```
Detection                Triage              Response             Recovery
    │                       │                    │                    │
    │ 1. Alert Triggered   │                    │                    │
    ├─────────────────────>│                    │                    │
    │                       │                    │                    │
    │                       │ 2. Assess Severity │                    │
    │                       ├───────────────────>│                    │
    │                       │                    │                    │
    │                       │                    │ 3. Contain Threat │
    │                       │                    ├───────────────────>│
    │                       │                    │   • Disable accounts
    │                       │                    │   • Rotate keys   │
    │                       │                    │   • Block IPs     │
    │                       │                    │                    │
    │                       │                    │ 4. Investigate    │
    │                       │                    │   • Review logs    │
    │                       │                    │   • Timeline       │
    │                       │                    │   • Impact assess  │
    │                       │                    │                    │
    │                       │                    │ 5. Remediate      │
    │                       │                    │   • Deploy fixes   │
    │                       │                    │   • Notify users   │
    │                       │                    │                    │
    │                       │                    │ 6. Document       │
    │                       │                    ├───────────────────>│
    │                       │                    │                    │
    │                       │                    │                    │ 7. Post-Mortem
    │                       │                    │                    │   • Root cause
    │                       │                    │                    │   • Prevention
    │                       │                    │                    │   • Training
    │                       │                    │                    │
```

## Database Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Table                               │
│                                                                  │
│  id (PK)     firebaseUid (unique)    email    name    photoURL │
│  ├─────────────────────────────────────────────────────────────┤
│  │ Indexed: firebaseUid (for fast auth lookups)               │
│  │ Cascade: ON DELETE CASCADE to all related tables           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ userId (FK)
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│      Projects Table       │    │     Sessions Table       │
│                          │    │                          │
│  id (PK)                 │    │  id (PK)                 │
│  userId (FK, indexed)    │    │  userId (FK, indexed)    │
│  name, description       │    │  projectId (FK)          │
│  settings (JSON)         │    │  name, description       │
│                          │    │  isActive                │
└────────┬─────────────────┘    └────────┬─────────────────┘
         │                               │
         │ projectId (FK)                │ sessionId (FK)
         │                               │
         ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   ProjectData Table      │    │   UploadedFile Table     │
│                          │    │                          │
│  id (PK)                 │    │  id (PK)                 │
│  projectId (FK, indexed) │    │  sessionId (FK, indexed) │
│  compressedData (Bytes)  │    │  parsedData (JSON)       │
│  fileHash (indexed)      │    │  fileHash (indexed)      │
│  analysisData (JSON)     │    │  dataSchema (JSON)       │
│  isActive, status        │    │                          │
└──────────────────────────┘    └──────────────────────────┘

Security Controls:
• All queries filtered by userId
• Foreign keys with CASCADE DELETE
• Row-level security (via application logic)
• Encrypted at rest (database-level)
• SSL/TLS for connections
• No raw SQL (Prisma ORM only)
• Indexes on userId for performance
```

## Key Security Principles Applied

### Defense in Depth
```
Multiple layers protect each resource:
1. Network (TLS)
2. Headers (CSP, XSS protection)
3. Rate limiting (DOS protection)
4. Authentication (who are you?)
5. Authorization (can you access this?)
6. Input validation (is this safe?)
7. Database (encrypted, parameterized)
```

### Principle of Least Privilege
```
• Users can only access their own data
• Admin role required for admin endpoints
• Firebase tokens have minimum required scopes
• Database connections use minimal permissions
• API keys scoped to specific services
```

### Fail Securely
```
• Authentication failures return 401 (not details)
• Authorization failures return 403 (not resource info)
• Errors logged internally, generic message to client
• Token expiration forces re-authentication
• Rate limit exceeded returns 429 (no bypass)
```

### Zero Trust
```
• Every request must be authenticated
• Every resource access must be authorized
• No implicit trust between layers
• User ID from token, never from request
• Verify ownership on every operation
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-14
**Next Review:** After implementing critical fixes
