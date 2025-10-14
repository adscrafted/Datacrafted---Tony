# Middleware Testing Plan

## Pre-Testing Setup

### 1. Verify Installation

```bash
# Check that middleware.ts exists in project root
ls -la middleware.ts

# Should show:
# -rw-r--r--  1 user  staff  XXXX  Oct 10  middleware.ts
```

### 2. Configure Environment

```bash
# Copy .env.example to .env.local if not already done
cp .env.example .env.local

# Edit .env.local and ensure:
NEXT_PUBLIC_DEBUG_MODE=false
NODE_ENV=development
```

### 3. Restart Development Server

```bash
# Kill existing dev server (Ctrl+C)
# Start fresh
npm run dev
```

## Test Suite

### Test 1: Verify Middleware Loads

**Goal:** Confirm middleware is being executed

**Steps:**
1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:3000`
3. Open browser DevTools → Console
4. Navigate to `/dashboard`

**Expected Console Output:**
```
[MIDDLEWARE] Request: {
  pathname: '/dashboard',
  method: 'GET',
  hasSession: false,
  hasAuthHeader: false
}
[MIDDLEWARE] Route not protected - allowing access
OR
[MIDDLEWARE] Unauthorized access to /dashboard - redirecting to /
```

**Result:**
- [ ] PASS: Middleware logs appear in console
- [ ] FAIL: No middleware logs → middleware not running

### Test 2: Protected Route Without Authentication

**Goal:** Verify unauthenticated users are redirected

**Steps:**
1. **Clear all cookies:**
   - DevTools → Application → Cookies
   - Right-click → Clear all

2. **Disable debug mode:**
   ```env
   NEXT_PUBLIC_DEBUG_MODE=false
   ```

3. **Try to access protected routes:**
   - Visit `http://localhost:3000/dashboard`
   - Visit `http://localhost:3000/projects`
   - Visit `http://localhost:3000/account/profile`

**Expected Behavior:**
- Redirected to: `/?auth_required=true&redirect_from=/dashboard`
- Console log: `[MIDDLEWARE] Unauthorized access to /dashboard - redirecting to /`
- Page shows landing page with optional "Please sign in" message

**Result:**
- [ ] PASS: All protected routes redirect to `/`
- [ ] FAIL: Protected route loads without auth

### Test 3: Protected Route With Authentication

**Goal:** Verify authenticated users can access protected routes

**Steps:**
1. **Sign in to the application:**
   - Click "Sign In" button
   - Enter valid credentials
   - Complete sign-in flow

2. **Verify session cookie:**
   - DevTools → Application → Cookies
   - Look for `__session` cookie
   - Should have a long encrypted value

3. **Access protected routes:**
   - Visit `http://localhost:3000/dashboard`
   - Visit `http://localhost:3000/projects`

**Expected Behavior:**
- Pages load successfully (no redirect)
- Console log: `[MIDDLEWARE] Authenticated - allowing access to /dashboard`
- Dashboard/projects page renders normally

**Result:**
- [ ] PASS: Protected routes load when authenticated
- [ ] FAIL: Still redirected even with valid session

### Test 4: Public Routes Always Accessible

**Goal:** Verify public routes work without auth

**Steps:**
1. **Clear all cookies** (ensure not logged in)

2. **Visit public routes:**
   - `http://localhost:3000/` (landing)
   - `http://localhost:3000/api/health` (if exists)

**Expected Behavior:**
- All public routes load without redirect
- Console log: `[MIDDLEWARE] Public route - allowing access`
- No authentication required

**Result:**
- [ ] PASS: Public routes accessible without auth
- [ ] FAIL: Public routes redirect to login

### Test 5: JavaScript Disabled (Critical Security Test)

**Goal:** Prove server-side protection works when JavaScript is disabled

**Steps:**
1. **Disable JavaScript in browser:**
   - Chrome: DevTools → ⚙️ Settings → Debugger → "Disable JavaScript"
   - Firefox: `about:config` → `javascript.enabled` → false

2. **Clear all cookies** (ensure not logged in)

3. **Try to access protected route:**
   - Visit `http://localhost:3000/dashboard`

**Expected Behavior:**
- Still redirected to `/` even with JavaScript disabled
- This proves protection is server-side, not client-side
- Client-side auth modal won't show (because JS is disabled)
- But middleware still blocks access

**Result:**
- [ ] PASS: Redirected even with JS disabled (CRITICAL!)
- [ ] FAIL: Protected page loads with JS disabled (SECURITY VULNERABILITY!)

### Test 6: Debug Mode (Development)

**Goal:** Verify debug mode allows access in development

**Steps:**
1. **Enable debug mode:**
   ```env
   NEXT_PUBLIC_DEBUG_MODE=true
   NODE_ENV=development
   ```

2. **Restart dev server**

3. **Clear all cookies**

4. **Access protected route:**
   - Visit `http://localhost:3000/projects`

**Expected Behavior:**
- Page loads successfully
- Console warning: `⚠️ DEBUG_MODE: Bypassing auth for /projects`
- Console warning: `This should NEVER happen in production!`
- Response header: `X-Debug-Mode: true`

**Result:**
- [ ] PASS: Debug mode allows access in development
- [ ] FAIL: Debug mode doesn't work

### Test 7: Debug Mode Blocked in Production

**Goal:** Verify debug mode is blocked in production

**Steps:**
1. **Simulate production environment:**
   ```env
   NEXT_PUBLIC_DEBUG_MODE=true
   NODE_ENV=production
   ```

2. **Restart dev server with production build:**
   ```bash
   npm run build
   npm run start
   ```

3. **Clear all cookies**

4. **Try to access protected route:**
   - Visit `http://localhost:3000/dashboard`

**Expected Behavior:**
- Redirected to `/` (debug mode is blocked!)
- Console error: `🚨 [MIDDLEWARE SECURITY] CRITICAL: Attempted to enable DEBUG_MODE in production`
- Debug mode does NOT work in production

**Result:**
- [ ] PASS: Debug mode blocked in production (CRITICAL!)
- [ ] FAIL: Debug mode works in production (SECURITY VULNERABILITY!)

### Test 8: API Routes Not Affected

**Goal:** Verify middleware doesn't interfere with API routes

**Steps:**
1. **Clear all cookies**

2. **Call API route without auth:**
   ```bash
   curl http://localhost:3000/api/projects
   ```

**Expected Behavior:**
- Not redirected by middleware (API routes excluded)
- Returns 401 Unauthorized (from API middleware, not page middleware)
- JSON response: `{"error": {"code": "NO_TOKEN", "message": "..."}}`

**Result:**
- [ ] PASS: API routes handled by API middleware, not page middleware
- [ ] FAIL: API routes redirected to `/`

### Test 9: Session Cookie Expiration

**Goal:** Verify expired session cookies are rejected

**Steps:**
1. **Sign in** (get valid session cookie)

2. **Manually expire the cookie:**
   - DevTools → Application → Cookies
   - Find `__session` cookie
   - Edit "Expires" to past date
   - OR delete the cookie entirely

3. **Try to access protected route:**
   - Visit `http://localhost:3000/dashboard`

**Expected Behavior:**
- Redirected to `/` (expired cookie = no credential)
- Console log: `[MIDDLEWARE] Unauthorized access to /dashboard`

**Result:**
- [ ] PASS: Expired/missing cookies cause redirect
- [ ] FAIL: Expired cookies still work

### Test 10: Authorization Header (API/Mobile)

**Goal:** Verify Bearer token authentication works

**Steps:**
1. **Sign in and get Firebase ID token:**
   ```javascript
   // In browser console while signed in
   const user = firebase.auth().currentUser
   const token = await user.getIdToken()
   console.log(token)
   ```

2. **Use token in fetch request:**
   ```javascript
   fetch('/dashboard', {
     headers: {
       'Authorization': `Bearer ${token}`
     }
   })
   ```

**Expected Behavior:**
- Request succeeds (middleware finds Bearer token)
- Console log: `[MIDDLEWARE] Auth: Found Bearer token`
- Page loads (no redirect)

**Result:**
- [ ] PASS: Bearer token authentication works
- [ ] FAIL: Bearer token not recognized

## Performance Tests

### Test 11: Middleware Performance

**Goal:** Verify middleware doesn't slow down requests

**Steps:**
1. **Enable performance monitoring:**
   - DevTools → Network tab
   - Enable "Timing" column

2. **Load protected route** (while authenticated)

3. **Check timing:**
   - Look at "Server Timing" or "TTFB" (Time to First Byte)
   - Should be < 100ms for middleware processing

**Expected Metrics:**
- Middleware overhead: < 10ms
- Total TTFB: < 100ms (on localhost)

**Result:**
- [ ] PASS: Minimal performance impact (< 10ms)
- [ ] FAIL: Significant slowdown (> 50ms)

### Test 12: Load Test

**Goal:** Verify middleware handles many requests

**Steps:**
1. **Use a load testing tool:**
   ```bash
   # Install Apache Bench (if not installed)
   brew install apache2  # macOS

   # Run 100 requests, 10 concurrent
   ab -n 100 -c 10 http://localhost:3000/dashboard
   ```

**Expected Behavior:**
- All requests complete successfully
- No memory leaks or crashes
- Consistent response times

**Result:**
- [ ] PASS: Handles load without issues
- [ ] FAIL: Crashes or slows down significantly

## Integration Tests

### Test 13: Client-Side Auth Integration

**Goal:** Verify middleware works with AuthGateModal

**Steps:**
1. **Clear cookies**

2. **Visit protected route:**
   - `http://localhost:3000/dashboard`

3. **Observe behavior:**
   - Should show AuthGateModal (client-side)
   - OR redirect to `/` (server-side)
   - Both are acceptable - defense in depth

**Expected Behavior:**
- Page either shows auth modal or redirects
- User cannot access protected content
- Logs show both middleware and client-side checks

**Result:**
- [ ] PASS: Both layers work together
- [ ] FAIL: Conflict between middleware and client-side

### Test 14: API Middleware Integration

**Goal:** Verify page middleware doesn't interfere with API middleware

**Steps:**
1. **Sign in** (get valid session)

2. **Call protected API route:**
   ```javascript
   const token = await user.getIdToken()

   fetch('/api/projects', {
     headers: {
       'Authorization': `Bearer ${token}`
     }
   })
   ```

**Expected Behavior:**
- API call succeeds
- Data returned from API
- Both middleware layers work independently

**Result:**
- [ ] PASS: API and page middleware work together
- [ ] FAIL: Conflict or interference

## Edge Cases

### Test 15: Nested Routes

**Goal:** Verify middleware works on nested protected routes

**Steps:**
1. **Clear cookies**

2. **Try deeply nested routes:**
   - `/dashboard?session=123`
   - `/projects/abc123/edit`
   - `/account/profile/edit`

**Expected Behavior:**
- All nested routes are protected
- All redirect to `/`
- Middleware catches all variations

**Result:**
- [ ] PASS: All nested routes protected
- [ ] FAIL: Some nested routes accessible

### Test 16: Query Parameters Preserved

**Goal:** Verify query params are preserved in redirects

**Steps:**
1. **Clear cookies**

2. **Visit protected route with params:**
   - `http://localhost:3000/dashboard?session=123&view=charts`

**Expected Behavior:**
- Redirected to: `/?auth_required=true&redirect_from=/dashboard`
- Original params (`session`, `view`) are lost (expected)
- `redirect_from` param added for post-login redirect

**Result:**
- [ ] PASS: Redirect URL is correct
- [ ] FAIL: Redirect URL malformed

### Test 17: Special Characters in URL

**Goal:** Verify middleware handles special characters

**Steps:**
1. **Try URLs with special characters:**
   - `/dashboard?name=Test%20User`
   - `/projects/proj-123-abc`

**Expected Behavior:**
- Middleware handles special characters correctly
- No errors in console
- Proper redirect or access

**Result:**
- [ ] PASS: Special characters handled correctly
- [ ] FAIL: Errors with special characters

## Regression Tests

### Test 18: Existing Functionality Unchanged

**Goal:** Verify middleware doesn't break existing features

**Steps:**
1. **Sign in successfully**

2. **Test core features:**
   - Upload a file
   - View dashboard
   - Create charts
   - Use chat interface

**Expected Behavior:**
- All features work normally
- No new errors in console
- Performance is same or better

**Result:**
- [ ] PASS: All features work as before
- [ ] FAIL: Some features broken

## Test Results Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Results                              │
├─────────────────────────────────────────────────────────────┤
│ Test  1: Middleware Loads               [ ]                 │
│ Test  2: Protected Without Auth         [ ]                 │
│ Test  3: Protected With Auth            [ ]                 │
│ Test  4: Public Routes                  [ ]                 │
│ Test  5: JavaScript Disabled (CRITICAL) [ ]                 │
│ Test  6: Debug Mode Dev                 [ ]                 │
│ Test  7: Debug Mode Production (CRITICAL) [ ]               │
│ Test  8: API Routes Not Affected        [ ]                 │
│ Test  9: Session Expiration             [ ]                 │
│ Test 10: Authorization Header           [ ]                 │
│ Test 11: Performance                    [ ]                 │
│ Test 12: Load Test                      [ ]                 │
│ Test 13: Client-Side Integration        [ ]                 │
│ Test 14: API Middleware Integration     [ ]                 │
│ Test 15: Nested Routes                  [ ]                 │
│ Test 16: Query Parameters               [ ]                 │
│ Test 17: Special Characters             [ ]                 │
│ Test 18: Existing Functionality         [ ]                 │
├─────────────────────────────────────────────────────────────┤
│ Total Tests: 18                                             │
│ Passed: __                                                  │
│ Failed: __                                                  │
│ Critical Failures: __                                       │
└─────────────────────────────────────────────────────────────┘

CRITICAL TESTS (must pass):
- Test 5: JavaScript Disabled
- Test 7: Debug Mode Blocked in Production
```

## Troubleshooting Failed Tests

### If Test 1 Fails (Middleware Not Loading)

**Check:**
1. File is named `middleware.ts` (not `.js`)
2. File is in project root (not `app/` or `lib/`)
3. Dev server was restarted after creating file
4. No TypeScript errors in file

**Fix:**
```bash
# Verify file location
ls -la middleware.ts

# Check for errors
npm run build
```

### If Test 2 Fails (Protected Route Loads Without Auth)

**Check:**
1. `NEXT_PUBLIC_DEBUG_MODE=false` in `.env.local`
2. Cookies are actually cleared
3. Matcher pattern includes the route

**Fix:**
```env
# In .env.local
NEXT_PUBLIC_DEBUG_MODE=false
NODE_ENV=development
```

### If Test 5 Fails (JavaScript Disabled)

**This is a CRITICAL failure!**

**Check:**
1. Middleware is actually running (check Test 1)
2. Route is in PROTECTED_ROUTES array
3. No client-side redirect happening before server check

**Fix:**
- Review middleware logic
- Ensure server-side check happens first

### If Test 7 Fails (Debug Mode Works in Production)

**This is a CRITICAL SECURITY FAILURE!**

**Check:**
1. `isDebugModeEnabled()` function checks `NODE_ENV`
2. Both conditions (debug env var AND development mode) required
3. No way to bypass production check

**Fix:**
- Review security guards in `isDebugModeEnabled()`
- Add additional production environment checks

## Post-Testing Checklist

After all tests pass:

- [ ] Disable debug mode: `NEXT_PUBLIC_DEBUG_MODE=false`
- [ ] Verify production build works: `npm run build && npm run start`
- [ ] Test in production-like environment (Vercel preview, etc.)
- [ ] Review middleware logs in production
- [ ] Monitor performance metrics
- [ ] Set up alerts for authentication failures

## Continuous Testing

Add these to your CI/CD pipeline:

```yaml
# .github/workflows/test-middleware.yml
name: Test Middleware

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build  # Verify middleware compiles
      - run: npm run test   # Run test suite
```

## Conclusion

This comprehensive test plan ensures:
- ✅ Middleware protects routes server-side
- ✅ Cannot be bypassed by disabling JavaScript
- ✅ Debug mode works in development only
- ✅ Performance impact is minimal
- ✅ Integration with existing auth system
- ✅ No breaking changes to existing features

**Next Steps:**
1. Run all tests
2. Fix any failures
3. Deploy to production
4. Monitor for issues
