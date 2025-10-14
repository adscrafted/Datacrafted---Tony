# User Sync - Quick Reference Guide

## Overview

Automatic synchronization of Firebase Authentication users with Postgres database via Prisma.

## Files Created

```
prisma/schema.prisma              # Updated User model with firebaseUid
lib/api/user-service.ts           # User database operations
lib/middleware/auth.ts            # Authentication middleware
app/api/user/sync/route.ts        # Sync API endpoint
lib/utils/api-client.ts           # Client API utilities
lib/contexts/auth-context.tsx     # Updated auth context
```

## Quick Start

### 1. Run Database Migration

```bash
npx prisma migrate dev --name add_firebase_uid_to_user
npx prisma generate
```

### 2. Test in Debug Mode

```env
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
```

```bash
npm run dev
```

Sign in with any credentials - user will be synced automatically.

### 3. Verify in Database

```bash
npx prisma studio
```

Navigate to User table and check for the synced user.

## How It Works

### Automatic Flow

```
User Signs In → Auth Context → syncUserToDatabase()
→ POST /api/user/sync → User Service → Database Upsert
```

### What Gets Synced

- `firebaseUid` - Links Firebase to Postgres
- `email` - User email
- `name` - Display name
- `photoURL` - Profile picture
- `createdAt` - First sync timestamp
- `updatedAt` - Last sync timestamp

## API Endpoint

### POST /api/user/sync

**Request:**
```bash
curl -X POST http://localhost:3000/api/user/sync \
  -H "Authorization: Bearer <firebase-token>"
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "cuid123",
    "firebaseUid": "firebase-uid-123",
    "email": "user@example.com",
    "name": "John Doe",
    "photoURL": "https://...",
    "createdAt": "2025-10-10T...",
    "updatedAt": "2025-10-10T..."
  }
}
```

## Common Operations

### Sync User Manually

```typescript
import { syncUserToDatabase } from '@/lib/utils/api-client'
import { useAuth } from '@/lib/contexts/auth-context'

const { user } = useAuth()
const result = await syncUserToDatabase(user)
```

### Get User from Database

```typescript
import { getUserByFirebaseUid } from '@/lib/api/user-service'

const user = await getUserByFirebaseUid('firebase-uid-123')
```

### Update User Profile

```typescript
import { updateUser } from '@/lib/api/user-service'

await updateUser(userId, {
  name: 'New Name',
  photoURL: 'https://new-photo.jpg'
})
```

### Protect API Route

```typescript
import { withAuth } from '@/lib/middleware/auth'

export const GET = withAuth(async (request, user) => {
  // user.uid, user.email available
  return Response.json({ userId: user.uid })
})
```

## User Service Functions

| Function | Purpose |
|----------|---------|
| `syncUser(firebaseUser)` | Create or update user |
| `getUserByFirebaseUid(uid)` | Get user by Firebase UID |
| `getUser(userId)` | Get user by database ID |
| `updateUser(userId, data)` | Update user profile |
| `deleteUser(userId)` | Delete user |
| `getUserWithSessions(userId)` | Get user + sessions |
| `migrateAnonymousSessions(userId, sessionIds)` | Migrate sessions |

## Auth Middleware Functions

| Function | Purpose |
|----------|---------|
| `withAuth(handler)` | Require authentication |
| `authenticate(request)` | Manual auth check |
| `isAuthenticated(request)` | Check auth status |
| `createAuthRoute<P>(handler)` | Type-safe auth route |

## Testing

### Debug Mode

```typescript
// Automatically uses debug user
{
  uid: 'debug-user-123',
  email: 'debug@datacrafted.com',
  displayName: 'Debug User'
}
```

### Check Console Logs

```
🔄 [AUTH] Syncing user to database: debug-user-123
[API-CLIENT] Syncing user to database: debug-user-123
[API] Syncing user: debug-user-123
[USER-SERVICE] Syncing Firebase user to database: debug-user-123
[USER-SERVICE] User synced successfully: cuid...
✅ [AUTH] User synced to database: cuid...
```

## Troubleshooting

### "Unauthorized" Error
- Check user is signed in
- Verify Authorization header
- Check console logs

### User Not Syncing
- Check database is running
- Run `npx prisma generate`
- Verify `DATABASE_URL` in .env

### Migration Fails
```bash
# Reset database (WARNING: deletes data)
npx prisma migrate reset

# Or fix manually, then migrate
npx prisma migrate dev
```

## Next Steps

1. Test sync flow in debug mode
2. Verify database records
3. Implement Firebase Admin SDK for production
4. Add rate limiting if needed
5. Set up monitoring

## Production Checklist

- [ ] Disable debug mode: `NEXT_PUBLIC_DEBUG_MODE=false`
- [ ] Configure real Firebase credentials
- [ ] Implement Firebase Admin SDK token verification
- [ ] Add rate limiting to /api/user/sync
- [ ] Set up error monitoring
- [ ] Test with real users
- [ ] Add user analytics

## Resources

- Full Documentation: `USER_SYNC_IMPLEMENTATION.md`
- Prisma Docs: https://www.prisma.io/docs
- Firebase Auth: https://firebase.google.com/docs/auth
- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
