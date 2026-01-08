/**
 * Admin Configuration
 *
 * Centralized admin access control configuration.
 * Used by both frontend and backend for consistent authorization.
 */

/**
 * List of admin email addresses
 * Add new admin emails here - they will be recognized across the entire application
 */
export const ADMIN_EMAILS = [
  'sales@nnlgroup.co',
  'tony@datacrafted.com',
  // Add other admin emails as needed
] as const

/**
 * Check if an email address belongs to an admin
 * Case-insensitive comparison
 *
 * @param email - Email address to check
 * @returns true if the email is an admin email
 */
export function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.some(
    adminEmail => adminEmail.toLowerCase() === email.toLowerCase()
  )
}
