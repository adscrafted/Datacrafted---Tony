# User Synchronization Flow Diagrams

## Complete Authentication & Sync Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USER SIGN UP FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

    USER                 FIREBASE           AUTH CONTEXT         API           DATABASE
     │                     │                     │               │                │
     │  Sign Up Form       │                     │               │                │
     ├────────────────────>│                     │               │                │
     │  email, password    │                     │               │                │
     │                     │                     │               │                │
     │                     │ Create Account      │               │                │
     │                     │ (Firebase Auth)     │               │                │
     │                     │                     │               │                │
     │   User Created      │                     │               │                │
     │<────────────────────┤                     │               │                │
     │   { uid, email }    │                     │               │                │
     │                     │                     │               │                │
     │                     │  onAuthStateChanged │               │                │
     │                     ├────────────────────>│               │                │
     │                     │  Firebase User      │               │                │
     │                     │                     │               │                │
     │                     │                     │ Sync User     │                │
     │                     │                     ├──────────────>│                │
     │                     │                     │ POST /sync    │                │
     │                     │                     │ + Auth Token  │                │
     │                     │                     │               │                │
     │                     │                     │               │ Verify Token   │
     │                     │                     │               │ (Middleware)   │
     │                     │                     │               │                │
     │                     │                     │               │ UPSERT User    │
     │                     │                     │               ├───────────────>│
     │                     │                     │               │ firebaseUid,   │
     │                     │                     │               │ email, name    │
     │                     │                     │               │                │
     │                     │                     │               │ User Created   │
     │                     │                     │               │<───────────────┤
     │                     │                     │               │ { id, ... }    │
     │                     │                     │               │                │
     │                     │                     │ Sync Success  │                │
     │                     │                     │<──────────────┤                │
     │                     │                     │ { user }      │                │
     │                     │                     │               │                │
     │                     │  User Synced ✓      │               │                │
     │                     │<────────────────────┤               │                │
     │                     │                     │               │                │
     │  Redirect to /projects                    │               │                │
     │<──────────────────────────────────────────┤               │                │
     │                     │                     │               │                │


┌──────────────────────────────────────────────────────────────────────────┐
│                          USER SIGN IN FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

    USER                 FIREBASE           AUTH CONTEXT         API           DATABASE
     │                     │                     │               │                │
     │  Sign In Form       │                     │               │                │
     ├────────────────────>│                     │               │                │
     │  email, password    │                     │               │                │
     │                     │                     │               │                │
     │                     │ Validate Credentials│               │                │
     │                     │ (Firebase Auth)     │               │                │
     │                     │                     │               │                │
     │   Authenticated     │                     │               │                │
     │<────────────────────┤                     │               │                │
     │   { uid, email }    │                     │               │                │
     │                     │                     │               │                │
     │                     │  onAuthStateChanged │               │                │
     │                     ├────────────────────>│               │                │
     │                     │  Firebase User      │               │                │
     │                     │                     │               │                │
     │                     │                     │ Sync User     │                │
     │                     │                     ├──────────────>│                │
     │                     │                     │ POST /sync    │                │
     │                     │                     │ + Auth Token  │                │
     │                     │                     │               │                │
     │                     │                     │               │ Verify Token   │
     │                     │                     │               │                │
     │                     │                     │               │ UPSERT User    │
     │                     │                     │               ├───────────────>│
     │                     │                     │               │ UPDATE where   │
     │                     │                     │               │ firebaseUid    │
     │                     │                     │               │                │
     │                     │                     │               │ User Updated   │
     │                     │                     │               │<───────────────┤
     │                     │                     │               │ { id, ... }    │
     │                     │                     │               │                │
     │                     │                     │ Sync Success  │                │
     │                     │                     │<──────────────┤                │
     │                     │                     │               │                │
     │                     │                     │ Migrate Projects               │
     │                     │                     ├───────────────────────────────>│
     │                     │                     │ UPDATE projects                │
     │                     │                     │ WHERE userId = 'anonymous'     │
     │                     │                     │                                │
     │                     │                     │ Projects Migrated              │
     │                     │                     │<───────────────────────────────┤
     │                     │                     │                                │
     │  Redirect to /projects                    │                                │
     │<──────────────────────────────────────────┤                                │
     │  (with migrated data)                     │                                │


┌──────────────────────────────────────────────────────────────────────────┐
│                       GET USER PROFILE FLOW                               │
└──────────────────────────────────────────────────────────────────────────┘

   CLIENT                  API                    SERVICE              DATABASE
     │                      │                        │                     │
     │  GET /api/user       │                        │                     │
     ├─────────────────────>│                        │                     │
     │  Auth: Bearer <token>│                        │                     │
     │                      │                        │                     │
     │                      │ Verify Token           │                     │
     │                      │ (Auth Middleware)      │                     │
     │                      │ Extract user.uid       │                     │
     │                      │                        │                     │
     │                      │  Get User by UID       │                     │
     │                      ├───────────────────────>│                     │
     │                      │  firebaseUid           │                     │
     │                      │                        │                     │
     │                      │                        │ SELECT * FROM users │
     │                      │                        ├────────────────────>│
     │                      │                        │ WHERE firebaseUid   │
     │                      │                        │                     │
     │                      │                        │ User Record         │
     │                      │                        │<────────────────────┤
     │                      │                        │ { id, email, ... }  │
     │                      │                        │                     │
     │                      │  User Data             │                     │
     │                      │<───────────────────────┤                     │
     │                      │                        │                     │
     │  User Profile        │                        │                     │
     │<─────────────────────┤                        │                     │
     │  { user: {...} }     │                        │                     │


┌──────────────────────────────────────────────────────────────────────────┐
│                       UPDATE USER PROFILE FLOW                            │
└──────────────────────────────────────────────────────────────────────────┘

   CLIENT                  API                    SERVICE              DATABASE
     │                      │                        │                     │
     │  PATCH /api/user     │                        │                     │
     ├─────────────────────>│                        │                     │
     │  { name: "New Name" }│                        │                     │
     │  Auth: Bearer <token>│                        │                     │
     │                      │                        │                     │
     │                      │ Verify Token           │                     │
     │                      │ Validate Input         │                     │
     │                      │                        │                     │
     │                      │  Get User              │                     │
     │                      ├───────────────────────>│                     │
     │                      │                        │                     │
     │                      │                        │ SELECT user         │
     │                      │                        ├────────────────────>│
     │                      │                        │                     │
     │                      │                        │ User Found          │
     │                      │                        │<────────────────────┤
     │                      │                        │                     │
     │                      │  User Exists           │                     │
     │                      │<───────────────────────┤                     │
     │                      │                        │                     │
     │                      │  Update User           │                     │
     │                      ├───────────────────────>│                     │
     │                      │  { name: "New Name" }  │                     │
     │                      │                        │                     │
     │                      │                        │ UPDATE users        │
     │                      │                        ├────────────────────>│
     │                      │                        │ SET name = ...      │
     │                      │                        │ WHERE id = ...      │
     │                      │                        │                     │
     │                      │                        │ Updated User        │
     │                      │                        │<────────────────────┤
     │                      │                        │ { id, name, ... }   │
     │                      │                        │                     │
     │                      │  Updated Data          │                     │
     │                      │<───────────────────────┤                     │
     │                      │                        │                     │
     │  Success Response    │                        │                     │
     │<─────────────────────┤                        │                     │
     │  { success: true,    │                        │                     │
     │    user: {...} }     │                        │                     │


┌──────────────────────────────────────────────────────────────────────────┐
│                    UPSERT LOGIC (Database Layer)                          │
└──────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────┐
                    │  syncUser() Called      │
                    │  with Firebase User     │
                    └───────────┬─────────────┘
                                │
                                ↓
                    ┌─────────────────────────┐
                    │  Prisma Upsert:         │
                    │  WHERE firebaseUid      │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴──────────┐
                    │                      │
                    ↓                      ↓
        ┌──────────────────┐   ┌──────────────────┐
        │ User Exists?     │   │ User Not Found?  │
        │                  │   │                  │
        │ UPDATE:          │   │ CREATE:          │
        │ - email          │   │ - id (new cuid)  │
        │ - name           │   │ - firebaseUid    │
        │ - photoURL       │   │ - email          │
        │ - updatedAt      │   │ - name           │
        └──────────┬───────┘   │ - photoURL       │
                   │            │ - createdAt      │
                   │            │ - updatedAt      │
                   │            └────────┬─────────┘
                   │                     │
                   └──────────┬──────────┘
                              │
                              ↓
                   ┌─────────────────────┐
                   │ Return User Record  │
                   │ { id, email, ... }  │
                   └─────────────────────┘


┌──────────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING FLOW                                  │
└──────────────────────────────────────────────────────────────────────────┘

   REQUEST              MIDDLEWARE             HANDLER             RESPONSE
     │                     │                      │                    │
     │  No Auth Token      │                      │                    │
     ├────────────────────>│                      │                    │
     │                     │                      │                    │
     │                     │ Token Missing        │                    │
     │                     │                      │                    │
     │                     │          401 Unauthorized                 │
     │                     ├──────────────────────────────────────────>│
     │                     │          { error: "Unauthorized" }        │
     │                     │                                           │
     ├─────────────────────────────────────────────────────────────────────┤
     │                     │                      │                    │
     │  Invalid Token      │                      │                    │
     ├────────────────────>│                      │                    │
     │                     │                      │                    │
     │                     │ Verify Failed        │                    │
     │                     │                      │                    │
     │                     │          401 Unauthorized                 │
     │                     ├──────────────────────────────────────────>│
     │                     │          { error: "Invalid token" }       │
     │                     │                                           │
     ├─────────────────────────────────────────────────────────────────────┤
     │                     │                      │                    │
     │  Valid Token        │                      │                    │
     │  (User Not Found)   │                      │                    │
     ├────────────────────>│                      │                    │
     │                     │                      │                    │
     │                     │ Token Valid ✓        │                    │
     │                     ├─────────────────────>│                    │
     │                     │                      │                    │
     │                     │                      │ Get User (null)    │
     │                     │                      │                    │
     │                     │                      │ 404 Not Found      │
     │                     │                      ├───────────────────>│
     │                     │                      │ { error: "User    │
     │                     │                      │   not found" }     │
     │                     │                                           │
     ├─────────────────────────────────────────────────────────────────────┤
     │                     │                      │                    │
     │  Valid Request      │                      │                    │
     │  (Database Error)   │                      │                    │
     ├────────────────────>│                      │                    │
     │                     │                      │                    │
     │                     │ Token Valid ✓        │                    │
     │                     ├─────────────────────>│                    │
     │                     │                      │                    │
     │                     │                      │ Database Error     │
     │                     │                      │ (Connection Lost)  │
     │                     │                      │                    │
     │                     │                      │ 500 Server Error   │
     │                     │                      ├───────────────────>│
     │                     │                      │ { error: "Failed  │
     │                     │                      │   to sync user" }  │


┌──────────────────────────────────────────────────────────────────────────┐
│                  DATA RELATIONSHIP DIAGRAM                                │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐
│ Firebase Authentication │
│ (External Service)      │
│                         │
│ • uid                   │
│ • email                 │
│ • displayName           │
│ • photoURL              │
└────────────┬────────────┘
             │
             │ Linked by
             │ firebaseUid
             ↓
┌─────────────────────────────────────────────────┐
│ User (Postgres Table)                           │
│                                                 │
│ • id (Primary Key)                              │
│ • firebaseUid (Unique) ← Links to Firebase     │
│ • email                                         │
│ • name                                          │
│ • photoURL                                      │
│ • createdAt                                     │
│ • updatedAt                                     │
└────────────┬────────────────────────────────────┘
             │
             │ One-to-Many
             │
             ↓
┌─────────────────────────────────────────────────┐
│ Session (Postgres Table)                        │
│                                                 │
│ • id (Primary Key)                              │
│ • userId (Foreign Key) → User.id                │
│ • name                                          │
│ • createdAt                                     │
│ • updatedAt                                     │
└─────────────────────────────────────────────────┘
             │
             │ One-to-Many
             │
             ↓
┌─────────────────────────────────────────────────┐
│ UploadedFile, Analysis, Chart, etc.             │
│ (Future: Can also link to User)                 │
└─────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE PIPELINE                                    │
└──────────────────────────────────────────────────────────────────────────┘

    HTTP Request
         │
         ↓
    ┌────────────────────┐
    │ Next.js Routing    │
    │ Matches /api/user  │
    └────────┬───────────┘
             │
             ↓
    ┌────────────────────┐
    │ withAuth()         │
    │ Higher-Order Fn    │
    └────────┬───────────┘
             │
             ↓
    ┌────────────────────┐
    │ Extract Token      │
    │ from Header        │
    └────────┬───────────┘
             │
             ↓
    ┌────────────────────┐
    │ Verify Token       │
    │ (Firebase Admin)   │
    └────────┬───────────┘
             │
        ┌────┴────┐
        │         │
    Invalid   Valid
        │         │
        ↓         ↓
    ┌────────┐ ┌────────────────────┐
    │ Return │ │ Extract User Info  │
    │ 401    │ │ { uid, email, ... }│
    └────────┘ └────────┬───────────┘
                        │
                        ↓
               ┌────────────────────┐
               │ Call Route Handler │
               │ with (req, user)   │
               └────────┬───────────┘
                        │
                        ↓
               ┌────────────────────┐
               │ Handler Logic      │
               │ (User Service)     │
               └────────┬───────────┘
                        │
                        ↓
               ┌────────────────────┐
               │ Return Response    │
               │ JSON / Error       │
               └────────────────────┘


┌──────────────────────────────────────────────────────────────────────────┐
│               DEBUG MODE vs PRODUCTION MODE                               │
└──────────────────────────────────────────────────────────────────────────┘

DEBUG MODE (NEXT_PUBLIC_DEBUG_MODE=true)
──────────────────────────────────────────

    Sign In Request
         │
         ↓
    Auth Middleware
         │
         ↓
    Check DEBUG_MODE = true
         │
         ↓
    Return DEBUG_USER
    {
      uid: 'debug-user-123',
      email: 'debug@datacrafted.com',
      displayName: 'Debug User'
    }
         │
         ↓
    Handler receives user ✓
    (No token verification)


PRODUCTION MODE (NEXT_PUBLIC_DEBUG_MODE=false)
───────────────────────────────────────────────

    Sign In Request
         │
         ↓
    Auth Middleware
         │
         ↓
    Check DEBUG_MODE = false
         │
         ↓
    Extract Bearer token
         │
         ↓
    Verify with Firebase Admin SDK
    admin.auth().verifyIdToken(token)
         │
    ┌────┴────┐
    │         │
Invalid   Valid
    │         │
    ↓         ↓
  401     Extract user from
  Error   decoded token
              │
              ↓
         Handler receives
         verified user ✓


┌──────────────────────────────────────────────────────────────────────────┐
│                    COMPONENT INTERACTION                                  │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ App Component Tree                                          │
│                                                             │
│  ├─ AuthProvider (Context)                                 │
│  │   ├─ onAuthStateChanged listener                        │
│  │   ├─ syncUserAndMigrateProjects()                       │
│  │   └─ Provides: { user, signIn, signUp, logout }        │
│  │                                                          │
│  ├─ Page Components                                        │
│  │   ├─ useAuth() hook                                     │
│  │   └─ Access user state                                  │
│  │                                                          │
│  └─ Protected Routes                                       │
│      ├─ Check user !== null                                │
│      └─ Redirect if not authenticated                      │
└─────────────────────────────────────────────────────────────┘
              │
              │ API Calls
              ↓
┌─────────────────────────────────────────────────────────────┐
│ API Layer                                                   │
│                                                             │
│  ├─ /api/user/sync (POST)                                  │
│  │   └─ withAuth → syncUser()                              │
│  │                                                          │
│  ├─ /api/user (GET)                                        │
│  │   └─ withAuth → getUserByFirebaseUid()                  │
│  │                                                          │
│  ├─ /api/user (PATCH)                                      │
│  │   └─ withAuth → updateUser()                            │
│  │                                                          │
│  └─ /api/user (DELETE)                                     │
│      └─ withAuth → deleteUser()                            │
└─────────────────────────────────────────────────────────────┘
              │
              │ Service Calls
              ↓
┌─────────────────────────────────────────────────────────────┐
│ Service Layer                                               │
│                                                             │
│  User Service (lib/api/user-service.ts)                    │
│  ├─ syncUser()                                              │
│  ├─ getUserByFirebaseUid()                                  │
│  ├─ getUser()                                               │
│  ├─ updateUser()                                            │
│  ├─ deleteUser()                                            │
│  ├─ getUserWithSessions()                                   │
│  └─ migrateAnonymousSessions()                              │
└─────────────────────────────────────────────────────────────┘
              │
              │ Prisma Queries
              ↓
┌─────────────────────────────────────────────────────────────┐
│ Database Layer                                              │
│                                                             │
│  Postgres Database                                          │
│  ├─ users table                                             │
│  ├─ sessions table                                          │
│  ├─ uploaded_files table                                    │
│  └─ ... other tables                                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Flow Patterns

### 1. Happy Path (New User)
```
Sign Up → Firebase Creates User → Auth Context Detects →
Sync to DB → User Created → Projects Migrated → Dashboard
```

### 2. Happy Path (Returning User)
```
Sign In → Firebase Validates → Auth Context Detects →
Sync to DB → User Updated → Projects Migrated → Dashboard
```

### 3. Error Path (Unauthorized)
```
API Request → No Token → Middleware Rejects → 401 Response
```

### 4. Error Path (Database Down)
```
API Request → Token Valid → Service Call → DB Error → 500 Response
```

### 5. Recovery Path (Token Expired)
```
API Request → Token Expired → Auto Refresh → Retry Request → Success
```

## State Transitions

```
┌─────────────┐
│ Anonymous   │ ← Initial state
└──────┬──────┘
       │ Sign Up / Sign In
       ↓
┌─────────────┐
│ Authenticating │ ← Firebase validates
└──────┬──────┘
       │ Success
       ↓
┌─────────────┐
│ Syncing     │ ← Database sync
└──────┬──────┘
       │ Success
       ↓
┌─────────────┐
│ Authenticated │ ← User fully synced
└──────┬──────┘
       │ Logout
       ↓
┌─────────────┐
│ Anonymous   │ ← Back to initial
└─────────────┘
```

## Concurrency Handling

```
Multiple Tabs/Windows → Same User Sign In
    │
    ├─ Tab 1: onAuthStateChanged → Sync
    ├─ Tab 2: onAuthStateChanged → Sync
    └─ Tab 3: onAuthStateChanged → Sync
         │
         └─→ All call POST /api/user/sync
                │
                └─→ Database UPSERT (atomic)
                     │
                     └─→ Last write wins
                          (updatedAt = latest)
```

This ensures that concurrent syncs don't create duplicate users and the database remains consistent.
