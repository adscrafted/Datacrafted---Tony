# User Synchronization System - Implementation Summary

## Overview

This document describes the user synchronization system that syncs Firebase Authentication users with the Postgres database via Prisma. This enables data relationships and persistent user records while leveraging Firebase for authentication.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Authentication Flow                      │
└─────────────────────────────────────────────────────────────────┘

1. User Signs In/Up with Firebase
   ↓
2. AuthContext receives Firebase User
   ↓
3. syncUserAndMigrateProjects() called automatically
   ↓
4. syncUserToDatabase() makes API call
   ↓
5. POST /api/user/sync (with auth middleware)
   ↓
6. User Service: syncUser()
   ↓
7. Prisma upsert: Create or Update user in Postgres
   ↓
8. Return synced user data
   ↓
9. Migrate anonymous projects (if any)
```

## Files Created

### 1. **Prisma Schema Update** (`prisma/schema.prisma`)

**Changes:**
- Added `firebaseUid` field (unique, indexed) to User model
- Added `photoURL` field for user profile pictures
- Maintains backward compatibility with existing data

```prisma
model User {
  id          String   @id @default(cuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Firebase authentication
  firebaseUid String?  @unique

  // User profile
  name        String?
  email       String?
  photoURL    String?

  // Relationships
  sessions    Session[]
}
```

**Migration Required:** Yes
```bash
npx prisma migrate dev --name add_firebase_uid_to_user
npx prisma generate
```

---

### 2. **User Service** (`lib/api/user-service.ts`)

**Purpose:** Database operations for user management

**Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `syncUser()` | `FirebaseUserData` | `UserData` | Upsert user: create if not exists, update if exists |
| `getUserByFirebaseUid()` | `firebaseUid: string` | `UserData \| null` | Get user by Firebase UID |
| `getUser()` | `userId: string` | `UserData \| null` | Get user by database ID |
| `updateUser()` | `userId, data` | `UserData` | Update user profile |
| `deleteUser()` | `userId: string` | `boolean` | Delete user and cascade delete relations |
| `getUserWithSessions()` | `userId: string` | `User + Sessions` | Get user with their active sessions |
| `migrateAnonymousSessions()` | `userId, sessionIds[]` | `number` | Migrate anonymous sessions to user |

**Key Features:**
- Uses Prisma `upsert` for atomic create-or-update operations
- Comprehensive error logging
- Type-safe with TypeScript interfaces
- Supports session migration for anonymous users

---

### 3. **Auth Middleware** (`lib/middleware/auth.ts`)

**Purpose:** Protect API routes with Firebase authentication

**Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `extractFirebaseUser()` | `NextRequest` | `FirebaseUser \| null` | Extract user from Authorization header |
| `withAuth()` | `handler` | `Protected handler` | Require authentication |
| `withOptionalAuth()` | `handler` | `Optional auth handler` | Optional authentication |
| `createAuthToken()` | `user` | `string` | Create auth token (temporary) |

**Security:**
- Validates Authorization header format
- Supports debug mode for development
- TODO: Implement Firebase Admin SDK for production token verification

**Usage Example:**
```typescript
import { withAuth } from '@/lib/middleware/auth'

export const POST = withAuth(async (request, user) => {
  // user is guaranteed to be authenticated
  console.log('Authenticated user:', user.uid)
  // ... handler logic
})
```

---

### 4. **User Sync API Endpoint** (`app/api/user/sync/route.ts`)

**Endpoint:** `POST /api/user/sync`

**Request:**
```typescript
Headers:
  Authorization: Bearer <firebase-token>

// No body required - user data extracted from token
```

**Response (Success - 200):**
```json
{
  "success": true,
  "user": {
    "id": "cuid123...",
    "firebaseUid": "firebase-uid-123",
    "email": "user@example.com",
    "name": "John Doe",
    "photoURL": "https://...",
    "createdAt": "2025-10-10T...",
    "updatedAt": "2025-10-10T..."
  }
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized - Please sign in to continue"
}
```

**Response (Error - 500):**
```json
{
  "success": false,
  "error": "Failed to sync user to database"
}
```

---

### 5. **API Client Utilities** (`lib/utils/api-client.ts`)

**Purpose:** Client-side utilities for authenticated API requests

**Functions:**

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `createAuthHeader()` | `User` | `string \| null` | Create Authorization header |
| `authenticatedFetch()` | `url, user, options` | `Response` | Make authenticated request |
| `syncUserToDatabase()` | `User` | `{ success, user, error }` | Sync user to database |

**Usage Example:**
```typescript
import { syncUserToDatabase } from '@/lib/utils/api-client'
import { useAuth } from '@/lib/contexts/auth-context'

const { user } = useAuth()
const result = await syncUserToDatabase(user)
if (result.success) {
  console.log('User synced:', result.user)
}
```

---

### 6. **Auth Context Updates** (`lib/contexts/auth-context.tsx`)

**Changes:**
- Replaced `migrateAnonymousProjects()` with `syncUserAndMigrateProjects()`
- Automatically syncs user to database on authentication
- Maintains project migration functionality

**New Flow:**
```typescript
async function syncUserAndMigrateProjects(user: User) {
  // 1. Sync Firebase user to Postgres
  const syncResult = await syncUserToDatabase(user)

  // 2. Migrate anonymous projects to user
  // ... migration logic
}
```

**Triggers:**
- On user sign in (email/password or Google)
- On user sign up
- On auth state change (persistent sessions)
- In debug mode

---

## How It Works

### User Sign In Flow

```typescript
// 1. User signs in with Firebase
await signInWithEmailAndPassword(auth, email, password)

// 2. AuthContext receives user via onAuthStateChanged
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // 3. Automatically sync to database
    await syncUserAndMigrateProjects(user)
  }
})

// 3. syncUserToDatabase makes API call
const result = await syncUserToDatabase(user)

// 4. API endpoint receives request with auth token
POST /api/user/sync
Authorization: Bearer <token>

// 5. Middleware extracts Firebase user from token
const firebaseUser = await extractFirebaseUser(request)

// 6. User service performs upsert
await db.user.upsert({
  where: { firebaseUid: user.uid },
  update: { email, name, photoURL },
  create: { firebaseUid, email, name, photoURL }
})

// 7. User record now exists in Postgres
// Can be referenced in Session, Project models via userId
```

### First-Time User (Sign Up)

1. User signs up with Firebase → Creates Firebase account
2. Auto sync triggered → Creates Postgres user record
3. `firebaseUid` links the two systems
4. User can now have sessions, projects, etc.

### Returning User (Sign In)

1. User signs in with Firebase → Validates credentials
2. Auto sync triggered → Updates Postgres user record (email, name, photo)
3. `updatedAt` timestamp refreshed
4. Existing sessions and projects remain linked

### Anonymous User Migration

1. Anonymous user creates projects (userId = 'anonymous')
2. User signs up / signs in
3. Sync happens → User record created in Postgres
4. Anonymous projects migrated → userId updated to Firebase UID
5. User retains all their anonymous work

---

## Testing

### Test with Debug Mode

Debug mode bypasses Firebase authentication for easier testing:

```env
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
```

Debug user:
```typescript
{
  uid: 'debug-user-123',
  email: 'debug@datacrafted.com',
  displayName: 'Debug User'
}
```

### Test Flow

1. **Start the development server:**
```bash
npm run dev
```

2. **Navigate to authentication page:**
```
http://localhost:3000
```

3. **Sign in (debug mode accepts any credentials)**

4. **Check console logs:**
```
🔄 [AUTH] Syncing user to database: debug-user-123
[API-CLIENT] Syncing user to database: debug-user-123
[API] Syncing user: debug-user-123
[USER-SERVICE] Syncing Firebase user to database: debug-user-123
[USER-SERVICE] User synced successfully: cuid...
[API-CLIENT] User synced successfully: cuid...
✅ [AUTH] User synced to database: cuid...
```

5. **Verify in database:**
```bash
npx prisma studio
```
Navigate to User table and verify the record exists.

### Test with Real Firebase (Production)

1. **Disable debug mode:**
```env
NEXT_PUBLIC_DEBUG_MODE=false
```

2. **Configure Firebase:**
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
# ... other Firebase config
```

3. **Sign up with real credentials**

4. **Verify sync in database**

---

## Database Schema Changes

### Migration Command

```bash
# Create migration
npx prisma migrate dev --name add_firebase_uid_to_user

# This will:
# 1. Create a new migration file
# 2. Apply the migration to your database
# 3. Regenerate Prisma Client
```

### Migration Impact

**Safe Changes:**
- `firebaseUid` is nullable → Existing users won't break
- `photoURL` is nullable → No data required

**Post-Migration:**
- Existing users will have `firebaseUid = null`
- New users will have `firebaseUid` populated
- You can backfill existing users if needed

### Backfill Script (Optional)

If you have existing users you want to link to Firebase:

```typescript
// scripts/backfill-firebase-uids.ts
import { db } from '../lib/db'

// Map email → firebaseUid from Firebase
const emailToFirebaseUid = {
  'user1@example.com': 'firebase-uid-1',
  'user2@example.com': 'firebase-uid-2',
}

async function backfill() {
  for (const [email, firebaseUid] of Object.entries(emailToFirebaseUid)) {
    await db.user.updateMany({
      where: { email },
      data: { firebaseUid }
    })
  }
}

backfill()
```

---

## Security Considerations

### Current Implementation (Development)

**Auth Token:** Base64-encoded user data
- Simple for development
- NOT SECURE for production
- Easy to decode and manipulate

**Pros:**
- No external dependencies
- Works in debug mode
- Simple to implement

**Cons:**
- Not cryptographically signed
- Can be forged
- Should not be used in production

### Production Implementation (TODO)

**Required:** Firebase Admin SDK

```bash
npm install firebase-admin
```

**Server-Side Token Verification:**
```typescript
import admin from 'firebase-admin'

// Initialize Admin SDK
const serviceAccount = require('./firebase-service-account.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

// Verify ID token
export async function extractFirebaseUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.substring(7)

  try {
    // Verify the token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(token)

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      photoURL: decodedToken.picture
    }
  } catch (error) {
    return null
  }
}
```

**Client-Side Token Generation:**
```typescript
// In auth context, get ID token from Firebase
const idToken = await user.getIdToken()

// Send in Authorization header
fetch('/api/user/sync', {
  headers: {
    'Authorization': `Bearer ${idToken}`
  }
})
```

---

## Error Handling

### Client-Side (Auth Context)

```typescript
// Errors are logged but don't block authentication
try {
  await syncUserToDatabase(user)
} catch (error) {
  console.error('Failed to sync user:', error)
  // User can still use the app
  // Sync can be retried later
}
```

### Server-Side (API Endpoint)

```typescript
// Returns proper HTTP status codes
- 200: Success
- 401: Unauthorized (invalid/missing token)
- 500: Server error (database issue)
```

### Database (User Service)

```typescript
// Uses Prisma error handling
try {
  await db.user.upsert(...)
} catch (error) {
  console.error('[USER-SERVICE] Error:', error)
  throw new Error('Failed to sync user')
}
```

---

## Future Enhancements

### 1. Rate Limiting
```typescript
// lib/middleware/rate-limit.ts
export function withRateLimit(handler, limit = 10) {
  // Track requests per user
  // Block if exceeded
}
```

### 2. Caching
```typescript
// Cache user data to reduce database queries
const userCache = new Map<string, UserData>()
```

### 3. Webhook Sync
```typescript
// Firebase Auth trigger → Webhook → Auto sync
// No client-side call needed
```

### 4. Audit Logging
```typescript
// Track all user sync events
await db.auditLog.create({
  userId,
  action: 'user_sync',
  timestamp: new Date()
})
```

### 5. Batch Operations
```typescript
// Sync multiple users at once
export async function syncUsers(users: FirebaseUserData[]) {
  await db.user.createMany({ data: users })
}
```

---

## Common Issues & Solutions

### Issue: "Unauthorized" Error

**Cause:** Invalid or missing Authorization header

**Solution:**
1. Check that user is signed in
2. Verify `createAuthHeader()` is working
3. Check console logs for auth errors

### Issue: User Not Syncing

**Cause:** Database connection or Prisma error

**Solution:**
1. Check database is running
2. Run `npx prisma generate`
3. Verify `.env` has `DATABASE_URL`

### Issue: Duplicate Users

**Cause:** `firebaseUid` not unique

**Solution:**
1. Migration should add `@unique` constraint
2. Run `npx prisma migrate reset` (WARNING: deletes data)
3. Or manually fix duplicates in database

### Issue: Migration Fails

**Cause:** Existing data conflicts

**Solution:**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Or fix data manually, then migrate
npx prisma migrate dev
```

---

## API Reference

### POST /api/user/sync

Synchronize Firebase user with database.

**Authentication:** Required (Firebase ID token)

**Request:**
```http
POST /api/user/sync HTTP/1.1
Host: localhost:3000
Authorization: Bearer <firebase-id-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "cuid123",
    "firebaseUid": "firebase-uid-123",
    "email": "user@example.com",
    "name": "John Doe",
    "photoURL": "https://example.com/photo.jpg",
    "createdAt": "2025-10-10T12:00:00Z",
    "updatedAt": "2025-10-10T12:00:00Z"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized - Please sign in to continue"
}
```

**Response (500 Internal Server Error):**
```json
{
  "success": false,
  "error": "Failed to sync user to database"
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# Firebase (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Debug Mode (Development only)
NEXT_PUBLIC_DEBUG_MODE=true

# Session Configuration
SESSION_EXPIRE_DAYS=30
```

---

## Summary

This user synchronization system provides:

1. **Automatic Sync:** Users are synced on every authentication
2. **Upsert Logic:** Create new users, update existing users
3. **Type Safety:** Full TypeScript support
4. **Error Handling:** Graceful failures, detailed logging
5. **Debug Mode:** Easy testing without Firebase
6. **Migration Ready:** Existing anonymous data preserved
7. **Scalable:** Service-based architecture for future enhancements

**Next Steps:**
1. Run Prisma migration: `npx prisma migrate dev --name add_firebase_uid_to_user`
2. Test in debug mode
3. Implement Firebase Admin SDK for production
4. Add rate limiting and caching as needed

---

## Quick Reference

**Sync User Manually:**
```typescript
import { syncUserToDatabase } from '@/lib/utils/api-client'
import { useAuth } from '@/lib/contexts/auth-context'

const { user } = useAuth()
const result = await syncUserToDatabase(user)
```

**Get User from Database:**
```typescript
import { getUserByFirebaseUid } from '@/lib/api/user-service'

const user = await getUserByFirebaseUid('firebase-uid-123')
```

**Protect API Route:**
```typescript
import { withAuth } from '@/lib/middleware/auth'

export const POST = withAuth(async (request, user) => {
  // user.uid, user.email, etc. available
})
```

**Run Migration:**
```bash
npx prisma migrate dev --name add_firebase_uid_to_user
npx prisma generate
```

**View Database:**
```bash
npx prisma studio
```
