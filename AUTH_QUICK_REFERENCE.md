# Authentication Quick Reference

## TL;DR

**Landing Page:** Shows header with "Sign In" button → Opens modal → User authenticates → Header updates to show "Go to Dashboard"

**Protected Routes:** Check auth → Show gate if not authenticated → User signs in → Auto-redirect to intended page

**Debug Mode:** Set `DEBUG_MODE = true` in firebase config → All auth bypassed for development

## Component Usage

### 1. LandingHeader (Landing Page Only)

```tsx
import { LandingHeader } from '@/components/ui/landing-header'
import { useAuth } from '@/lib/contexts/auth-context'

const { user, logout } = useAuth()
const [authModalOpen, setAuthModalOpen] = useState(false)

<LandingHeader
  user={user}
  onSignInClick={() => setAuthModalOpen(true)}
  onLogout={logout}
/>
```

### 2. AuthModal (User-Initiated Auth)

```tsx
import { AuthModal } from '@/components/auth/auth-modal'

<AuthModal
  isOpen={authModalOpen}
  onClose={() => setAuthModalOpen(false)}
  defaultView="signin" // or "signup"
/>
```

### 3. AuthGateModal (Route Protection)

```tsx
import { AuthGateModal } from '@/components/auth/auth-gate-modal'
import { useAuth } from '@/lib/contexts/auth-context'

function ProtectedPage() {
  const { user, loading, isDebugMode } = useAuth()

  if (!loading && !user && !isDebugMode) {
    return <AuthGateModal
      redirectPath="/intended-path"
      message="Custom message here"
    />
  }

  return <div>Protected content</div>
}
```

## Common Patterns

### Pattern 1: Add Sign In Button to Any Page

```tsx
const [authModalOpen, setAuthModalOpen] = useState(false)

<button onClick={() => setAuthModalOpen(true)}>
  Sign In
</button>

<AuthModal
  isOpen={authModalOpen}
  onClose={() => setAuthModalOpen(false)}
/>
```

### Pattern 2: Protect a New Route

```tsx
// At the top of your page component
const { user, loading, isDebugMode } = useAuth()

// Before rendering your content
if (!loading && !user && !isDebugMode) {
  return <AuthGateModal redirectPath="/your-route" />
}
```

### Pattern 3: Show Different Content Based on Auth

```tsx
const { user } = useAuth()

return (
  <div>
    {user ? (
      <div>Welcome, {user.displayName}!</div>
    ) : (
      <div>Please sign in</div>
    )}
  </div>
)
```

### Pattern 4: Get User Info

```tsx
const { user } = useAuth()

if (user) {
  console.log('User ID:', user.uid)
  console.log('Email:', user.email)
  console.log('Display Name:', user.displayName)
  console.log('Photo URL:', user.photoURL)
}
```

## File Locations

```
components/
  auth/
    auth-modal.tsx           ← User-initiated auth modal
    auth-gate-modal.tsx      ← Route protection modal
    sign-in-form.tsx         ← Sign in form component
    sign-up-form.tsx         ← Sign up form component
    types.ts                 ← TypeScript types
    index.ts                 ← Barrel exports
  ui/
    landing-header.tsx       ← Landing page header

app/
  page.tsx                   ← Landing page (uses LandingHeader + AuthModal)
  dashboard/
    page.tsx                 ← Protected (uses AuthGateModal)
  projects/
    page.tsx                 ← Protected (uses AuthGateModal)

lib/
  contexts/
    auth-context.tsx         ← Auth provider and useAuth hook
```

## Auth Context API

```tsx
const {
  user,              // Firebase User object or null
  loading,           // Boolean: is auth state loading?
  error,             // String: error message if any
  signIn,            // Function: (email, password) => Promise<void>
  signUp,            // Function: (email, password, name) => Promise<void>
  logout,            // Function: () => Promise<void>
  signInWithGoogle,  // Function: () => Promise<void>
  resetPassword,     // Function: (email) => Promise<void>
  updateUserProfile, // Function: (name, photo) => Promise<void>
  isDebugMode        // Boolean: is debug mode active?
} = useAuth()
```

## Common Use Cases

### Log In a User

```tsx
const { signIn } = useAuth()

try {
  await signIn('user@example.com', 'password123')
  // User is now logged in, context will update automatically
} catch (error) {
  console.error('Login failed:', error)
}
```

### Sign Up a New User

```tsx
const { signUp } = useAuth()

try {
  await signUp('user@example.com', 'password123', 'John Doe')
  // User is now created and logged in
} catch (error) {
  console.error('Sign up failed:', error)
}
```

### Log Out

```tsx
const { logout } = useAuth()

try {
  await logout()
  // User is now logged out
  // Will redirect to landing page
} catch (error) {
  console.error('Logout failed:', error)
}
```

### Check If User Is Logged In

```tsx
const { user, loading } = useAuth()

if (loading) {
  return <div>Loading...</div>
}

if (user) {
  return <div>User is logged in</div>
}

return <div>User is not logged in</div>
```

## Styling Tokens

Use these to match the design system:

```tsx
// Colors
const colors = {
  primary: 'rgb(11,40,212)',      // Blue
  gradient: 'linear-gradient(to right, #71b2ff 0%, #3cf152 100%)',
  background: '#f8fafd',           // Light blue-gray
  text: '#1f1f1f',                // Dark gray
  textMuted: '#5f6368',           // Medium gray
}

// Fonts
const fonts = {
  primary: "'Google Sans Text', Helvetica, Arial, sans-serif",
  fallback: "Helvetica, Arial, sans-serif"
}

// Transitions
const transitions = {
  default: 'all 200ms ease',
  opacity: 'opacity 90%'
}
```

## Debug Mode

### Enable Debug Mode

In `lib/config/firebase.ts`:

```typescript
export const DEBUG_MODE = true
```

### What Debug Mode Does

1. Bypasses all authentication checks
2. Creates a fake user object (DEBUG_USER)
3. All protected routes are accessible
4. Perfect for development without setting up Firebase

### Disable for Production

```typescript
export const DEBUG_MODE = false
```

## Troubleshooting

### Modal Not Opening

```tsx
// Make sure you're managing state correctly
const [authModalOpen, setAuthModalOpen] = useState(false)

// Check the isOpen prop
<AuthModal isOpen={authModalOpen} ... />

// Make sure onSignInClick is wired up
<LandingHeader onSignInClick={() => setAuthModalOpen(true)} ... />
```

### Auth Gate Not Showing

```tsx
// Check all three conditions
const { user, loading, isDebugMode } = useAuth()

// Must wait for loading to complete
if (loading) {
  return <div>Loading...</div>
}

// All three must be false to show gate
if (!loading && !user && !isDebugMode) {
  return <AuthGateModal ... />
}
```

### User Not Redirecting After Auth

```tsx
// AuthGateModal handles redirect automatically
// Just make sure redirectPath is set correctly
<AuthGateModal redirectPath="/dashboard" />

// The modal uses this effect:
useEffect(() => {
  if (user || isDebugMode) {
    router.push(redirectPath)
  }
}, [user, isDebugMode, redirectPath])
```

### Header Not Updating After Auth

```tsx
// Make sure you're passing the user from useAuth
const { user } = useAuth()

<LandingHeader user={user} ... />

// The context updates automatically when user signs in
// The header will re-render with the new user
```

## Testing Checklist

Quick tests to verify everything works:

- [ ] Landing page shows "Sign In" when not logged in
- [ ] Clicking "Sign In" opens modal
- [ ] Can sign in with email/password
- [ ] Can sign up with email/password
- [ ] Header updates after sign in
- [ ] "Go to Dashboard" button appears
- [ ] Logout button works
- [ ] Accessing /dashboard without auth shows gate
- [ ] Accessing /projects without auth shows gate
- [ ] Auth gate redirects after successful auth
- [ ] Debug mode bypasses all auth
- [ ] Mobile layout looks good

## Next Steps

### Add Google Sign In Button

In `sign-in-form.tsx`, add:

```tsx
const { signInWithGoogle } = useAuth()

<button onClick={signInWithGoogle}>
  Sign in with Google
</button>
```

### Add Password Reset

The reset view exists but needs implementation:

```tsx
const { resetPassword } = useAuth()

await resetPassword('user@example.com')
// User will receive reset email
```

### Customize Messages

```tsx
<AuthGateModal
  redirectPath="/premium"
  message="Upgrade to premium to access this feature"
/>
```

---

**Quick Links:**
- [Full Documentation](./AUTH_INTEGRATION_SUMMARY.md)
- [Flow Diagrams](./AUTH_FLOW_DIAGRAM.md)
- [Component Source](./components/auth/)
