# Authentication Components

This directory contains all Firebase authentication UI components for DataCrafted.

## Components

### `AuthModal`
Main authentication modal that displays sign-in or sign-up forms.

**Usage:**
```tsx
import { AuthModal } from '@/components/auth'

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <AuthModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      defaultView="signin" // or "signup"
    />
  )
}
```

### `SignInForm`
Email/password and Google OAuth sign-in form.

**Features:**
- Email/password authentication
- Google OAuth integration
- Forgot password link
- Switch to sign-up view

### `SignUpForm`
User registration form with validation.

**Features:**
- Full name, email, password fields
- Password confirmation
- Password strength validation (min 6 chars)
- Google OAuth integration
- Switch to sign-in view

## Authentication Flow

1. User clicks "Sign In" or "Sign Up" button
2. `AuthModal` opens with appropriate view
3. User enters credentials or uses Google OAuth
4. Auth context (`useAuth()`) handles Firebase authentication
5. On success, modal closes and user is redirected to `/projects`
6. Anonymous projects are automatically migrated to user account

## Styling

All components use:
- NotebookLM-inspired design
- Google Sans fonts (with Inter fallback)
- Blue gradient accents (#71b2ff to #3cf152)
- Light blue-gray background (#f8fafd)
- Smooth transitions and hover effects

## Dependencies

- `@/lib/contexts/auth-context` - Authentication state and methods
- `firebase/auth` - Firebase Authentication SDK
- `@/lib/config/firebase` - Firebase configuration
