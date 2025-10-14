# API Security Quick Reference

## Summary of Security Implementation

All API endpoints have been secured with authentication middleware and ownership verification.

## Protected Endpoints

### Sessions API
| Endpoint | Method | Auth Required | Ownership Check | Rate Limited |
|----------|--------|---------------|-----------------|--------------|
| `/api/sessions` | POST | Yes | N/A (creates owned resource) | Yes |
| `/api/sessions` | GET | Yes | Auto-filtered by user | Yes |
| `/api/sessions/[id]` | GET | Yes | Yes | Yes |
| `/api/sessions/[id]` | PATCH | Yes | Yes | Yes |
| `/api/sessions/[id]` | DELETE | Yes | Yes | Yes |
| `/api/sessions/[id]/data` | GET | Yes | Yes | Yes |
| `/api/sessions/[id]/data` | POST | Yes | Yes | Yes |
| `/api/sessions/[id]/chat` | GET | Yes | Yes | Yes |
| `/api/sessions/[id]/chat` | POST | Yes | Yes | Yes |
| `/api/sessions/[id]/chat` | DELETE | Yes | Yes | Yes |

### AI & Analysis
| Endpoint | Method | Auth Required | Rate Limited |
|----------|--------|---------------|--------------|
| `/api/analyze` | POST | Yes | Yes (10/hour per user) |
| `/api/chat` | POST | Yes | Yes (30/hour per user) |
| `/api/chat` | GET | Yes | No |

## Security Features

### 1. Authentication
All endpoints require a valid Firebase ID token:
```bash
Authorization: Bearer <firebase-id-token>
```

### 2. Authorization
Endpoints verify resource ownership before allowing access:
- 404 if resource doesn't exist
- 403 if user doesn't own the resource

### 3. Rate Limiting
- User-specific rate limits (not IP-based)
- Prevents abuse and ensures fair usage

## Key Security Changes

### BEFORE (Vulnerable)
```typescript
// Accept userId from request body
const { userId } = await request.json()
await createSession({ userId })
```

### AFTER (Secure)
```typescript
// Use authenticated user only
const session = await createSession({
  userId: authUser.uid  // From verified token
})
```

## HTTP Status Codes

| Code | Meaning | When It Occurs |
|------|---------|----------------|
| 200 | Success | Request succeeded |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | User doesn't own the resource |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal server error |

## Frontend Integration

### Getting Auth Token
```typescript
import { auth } from '@/lib/config/firebase'

const token = await auth.currentUser?.getIdToken()
```

### Making Authenticated Requests
```typescript
const response = await fetch('/api/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'My Session' })
})
```

### Handling Auth Errors
```typescript
if (response.status === 401) {
  // Redirect to login
  router.push('/sign-in')
} else if (response.status === 403) {
  // Show error message
  toast.error('Access denied')
}
```

## Testing Checklist

- [ ] All endpoints require authentication (401 without token)
- [ ] Ownership checks prevent cross-user access (403)
- [ ] Rate limits are enforced per user
- [ ] Error messages don't leak information
- [ ] Session operations only work for owned resources

## Common Issues & Solutions

### Issue: 401 Unauthorized
**Cause:** Missing or invalid token
**Solution:**
1. Check if user is signed in
2. Get fresh token with `getIdToken()`
3. Include token in Authorization header

### Issue: 403 Forbidden
**Cause:** User doesn't own the resource
**Solution:**
1. Verify the session/resource ID
2. Check if user created this resource
3. Don't expose resource IDs from other users

### Issue: 429 Rate Limit
**Cause:** Too many requests
**Solution:**
1. Implement exponential backoff
2. Show user-friendly error message
3. Cache responses when possible

## Security Best Practices

1. **Never expose user IDs in URLs or client code**
2. **Always use authUser.uid from token**
3. **Don't trust any client-provided user identifiers**
4. **Implement proper error handling**
5. **Log security events for monitoring**

## Files Reference

- **Middleware:** `/lib/middleware/auth.ts`
- **Auth Utils:** `/lib/auth/server.ts`
- **Types:** `/lib/types/auth.ts`
- **Rate Limiting:** `/lib/middleware/rate-limit.ts`

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/analyze` | 10 requests | 1 hour |
| `/api/chat` | 30 requests | 1 hour |
| Session endpoints | Shared pool | Per operation |

## Support

For security questions or issues:
1. Check `/components/auth/AUTH_GUIDE.md`
2. Review `API_SECURITY_IMPLEMENTATION_SUMMARY.md`
3. Contact security team

---

**Last Updated:** 2025-10-10
**Security Status:** All endpoints protected
