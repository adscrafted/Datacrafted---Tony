/**
 * Zod Validation Schemas for API Endpoints
 *
 * This module provides comprehensive input validation for all API routes
 * using Zod schema definitions. Ensures data integrity and provides
 * detailed error messages for invalid requests.
 */

import { z } from 'zod'

/**
 * Common validation helpers
 */

// Common string validations
export const nonEmptyString = z.string().min(1, 'This field is required')
export const emailString = z.string().email('Invalid email address')
export const urlString = z.string().url('Invalid URL format')

// Common number validations
export const positiveNumber = z.number().positive('Must be a positive number')
export const nonNegativeNumber = z.number().nonnegative('Must be non-negative')

/**
 * Analyze API validation schemas
 */

// Column schema for data analysis
const columnSchema = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().optional()
})

// Schema for the main data schema
const dataSchemaSchema = z.object({
  fileName: z.string().optional(),
  columns: z.array(columnSchema).optional()
})

// Corrected schema column
const correctedColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  userCorrected: z.boolean()
})

// Main analyze request schema
export const analyzeRequestSchema = z.object({
  data: z.array(z.record(z.any()))
    .min(1, 'Data array cannot be empty')
    .max(100000, 'Dataset too large (max 100,000 rows)'),
  schema: dataSchemaSchema.optional(),
  correctedSchema: z.array(correctedColumnSchema).optional(),
  feedback: z.string().max(1000).optional(),
  fileName: z.string().max(255).optional()
})

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>

/**
 * Project API validation schemas
 */

// Create project validation
export const createProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  userId: z.string().min(1, 'User ID is required'),
  tags: z.array(z.string()).optional()
})

export type CreateProjectRequest = z.infer<typeof createProjectSchema>

// Update project validation
export const updateProjectSchema = z.object({
  name: z.string()
    .min(1, 'Project name is required')
    .max(100, 'Project name must be less than 100 characters')
    .optional(),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  tags: z.array(z.string()).optional()
})

export type UpdateProjectRequest = z.infer<typeof updateProjectSchema>

/**
 * Project data save validation
 */

// Metadata for uploaded files
const fileMetadataSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().positive('File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required')
})

// Save project data validation
export const saveProjectDataSchema = z.object({
  data: z.array(z.record(z.any()))
    .min(1, 'Data array cannot be empty')
    .max(100000, 'Dataset too large (max 100,000 rows)'),
  analysis: z.any().optional(), // TODO: Define proper analysis schema
  metadata: fileMetadataSchema
})

export type SaveProjectDataRequest = z.infer<typeof saveProjectDataSchema>

/**
 * Dashboard configuration validation
 */

// Chart customization schema
const chartCustomizationSchema = z.record(z.any())

// Dashboard config validation
export const dashboardConfigSchema = z.object({
  chartCustomizations: chartCustomizationSchema,
  currentTheme: z.string().nullable(),
  currentLayout: z.any().nullable(),
  dashboardFilters: z.any().nullable()
})

export type DashboardConfigRequest = z.infer<typeof dashboardConfigSchema>

// Save dashboard config validation
export const saveDashboardConfigSchema = z.object({
  config: dashboardConfigSchema
})

export type SaveDashboardConfigRequest = z.infer<typeof saveDashboardConfigSchema>

/**
 * Session/Chat API validation schemas
 */

// Chat message validation
export const chatMessageSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(5000, 'Message too long (max 5,000 characters)'),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string()
  })).optional()
})

export type ChatMessageRequest = z.infer<typeof chatMessageSchema>

/**
 * Authentication validation schemas
 */

// Sign up validation
export const signUpSchema = z.object({
  email: emailString,
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters')
    .optional()
})

export type SignUpRequest = z.infer<typeof signUpSchema>

// Sign in validation
export const signInSchema = z.object({
  email: emailString,
  password: z.string().min(1, 'Password is required')
})

export type SignInRequest = z.infer<typeof signInSchema>

/**
 * User profile validation schemas
 */

// Update user profile validation
export const updateUserProfileSchema = z.object({
  displayName: z.string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be less than 100 characters')
    .optional(),
  photoURL: z.string().url('Invalid photo URL').optional(),
  email: emailString.optional()
})

export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileSchema>

/**
 * Pagination validation schemas
 */

// Common pagination parameters
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
})

export type PaginationParams = z.infer<typeof paginationSchema>

/**
 * Upload validation schemas
 */

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  fileName: z.string()
    .min(1, 'File name is required')
    .max(255, 'File name too long'),
  fileSize: z.number()
    .positive('File size must be positive')
    .max(50 * 1024 * 1024, 'File too large (max 50MB)'), // 50MB limit
  mimeType: z.enum([
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json'
  ], { errorMap: () => ({ message: 'Invalid file type. Only CSV, Excel, and JSON files are allowed' }) })
})

export type FileUploadRequest = z.infer<typeof fileUploadSchema>

/**
 * ID parameter validation
 */

// UUID validation
export const uuidSchema = z.string().uuid('Invalid ID format')

// Project ID param validation
export const projectIdParamSchema = z.object({
  id: uuidSchema
})

export type ProjectIdParam = z.infer<typeof projectIdParamSchema>

// Session ID param validation
export const sessionIdParamSchema = z.object({
  id: uuidSchema
})

export type SessionIdParam = z.infer<typeof sessionIdParamSchema>

/**
 * Validation helper functions
 */

/**
 * Safely parse and validate data with Zod schema
 * Returns parsed data or throws validation error
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  return schema.parse(data)
}

/**
 * Safely parse and validate data with Zod schema
 * Returns result object with success/error
 */
export function validateDataSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, data: result.data }
  } else {
    return { success: false, error: result.error }
  }
}

/**
 * Format Zod validation errors for API responses
 */
export function formatValidationErrors(error: z.ZodError): {
  field: string
  message: string
}[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }))
}
