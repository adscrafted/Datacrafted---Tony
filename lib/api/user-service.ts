import { db, withDatabaseRetry, isDatabaseHealthy } from '../db'

/**
 * User service for managing Postgres user records synced from Firebase
 */

export interface FirebaseUserData {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export interface UserData {
  id: string
  firebaseUid: string | null
  email: string | null
  name: string | null
  photoURL: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Sync Firebase user to Postgres database
 * Creates a new user if they don't exist, updates if they do
 *
 * @param firebaseUser - Firebase user data from authentication
 * @returns Synced user record from database
 * @throws Error if database is unavailable or operation fails
 */
export async function syncUser(firebaseUser: FirebaseUserData): Promise<UserData> {
  try {
    console.log('[USER-SERVICE] Syncing Firebase user to database:', firebaseUser.uid)

    // Check database health before attempting operation
    if (!isDatabaseHealthy()) {
      console.warn('[USER-SERVICE] Database connection may be unhealthy, attempting operation anyway...')
    }

    // Upsert user: create if not exists, update if exists
    // Use retry mechanism to handle transient connection issues
    const user = await withDatabaseRetry(
      async () => {
        return await db.user.upsert({
          where: {
            firebaseUid: firebaseUser.uid,
          },
          update: {
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            updatedAt: new Date(),
          },
          create: {
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          },
        })
      },
      {
        retries: 2,
        timeout: 10000,
        retryDelay: 500,
        operationName: 'syncUser upsert'
      }
    )

    console.log('[USER-SERVICE] User synced successfully:', user.id)
    return user
  } catch (error: any) {
    console.error('[USER-SERVICE] Error syncing user:', error)

    // Provide more specific error messages
    if (error.message?.includes('timed out')) {
      throw new Error('Database operation timed out. Please try again.')
    } else if (error.message?.includes('connection')) {
      throw new Error('Unable to connect to database. Please check your connection.')
    } else if (error.code === 'P2002') {
      // Unique constraint violation
      console.error('[USER-SERVICE] Unique constraint violation - this should not happen with upsert')
      throw new Error('User already exists with conflicting data')
    }

    throw new Error('Failed to sync user to database')
  }
}

/**
 * Get user by Firebase UID
 *
 * @param firebaseUid - Firebase user ID
 * @returns User record or null if not found
 */
export async function getUserByFirebaseUid(firebaseUid: string): Promise<UserData | null> {
  try {
    const user = await db.user.findUnique({
      where: {
        firebaseUid,
      },
    })

    return user
  } catch (error) {
    console.error('[USER-SERVICE] Error fetching user by Firebase UID:', error)
    return null
  }
}

/**
 * Get user by database ID
 *
 * @param userId - Database user ID
 * @returns User record or null if not found
 */
export async function getUser(userId: string): Promise<UserData | null> {
  try {
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
    })

    return user
  } catch (error) {
    console.error('[USER-SERVICE] Error fetching user:', error)
    return null
  }
}

/**
 * Update user information
 *
 * @param userId - Database user ID
 * @param data - User data to update
 * @returns Updated user record
 */
export async function updateUser(
  userId: string,
  data: {
    email?: string | null
    name?: string | null
    photoURL?: string | null
  }
): Promise<UserData> {
  try {
    const user = await db.user.update({
      where: {
        id: userId,
      },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    console.log('[USER-SERVICE] User updated successfully:', userId)
    return user
  } catch (error) {
    console.error('[USER-SERVICE] Error updating user:', error)
    throw new Error('Failed to update user')
  }
}

/**
 * Delete user and all associated data
 *
 * @param userId - Database user ID
 * @returns True if deleted successfully
 */
export async function deleteUser(userId: string): Promise<boolean> {
  try {
    await db.user.delete({
      where: {
        id: userId,
      },
    })

    console.log('[USER-SERVICE] User deleted successfully:', userId)
    return true
  } catch (error) {
    console.error('[USER-SERVICE] Error deleting user:', error)
    return false
  }
}

/**
 * Get user with their sessions
 *
 * @param userId - Database user ID
 * @returns User with sessions or null
 */
export async function getUserWithSessions(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        sessions: {
          where: {
            isActive: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        },
      },
    })

    return user
  } catch (error) {
    console.error('[USER-SERVICE] Error fetching user with sessions:', error)
    return null
  }
}

/**
 * Migrate anonymous sessions to authenticated user
 * Called after user logs in to transfer their anonymous work
 *
 * @param userId - Database user ID
 * @param anonymousSessionIds - Array of session IDs to migrate
 * @returns Number of sessions migrated
 */
export async function migrateAnonymousSessions(
  userId: string,
  anonymousSessionIds: string[]
): Promise<number> {
  try {
    console.log('[USER-SERVICE] Migrating anonymous sessions to user:', userId)

    const result = await db.session.updateMany({
      where: {
        id: {
          in: anonymousSessionIds,
        },
        userId: null, // Only migrate truly anonymous sessions
      },
      data: {
        userId,
        updatedAt: new Date(),
      },
    })

    console.log('[USER-SERVICE] Migrated sessions:', result.count)
    return result.count
  } catch (error) {
    console.error('[USER-SERVICE] Error migrating sessions:', error)
    return 0
  }
}
