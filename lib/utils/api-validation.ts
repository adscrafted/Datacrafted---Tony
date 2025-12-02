import { z } from 'zod'
import { NextResponse } from 'next/server'
import { validationError, invalidJson } from './api-errors'

/**
 * Shared API Validation Utility
 *
 * This module provides Zod schemas and validation helpers for API routes.
 * Ensures consistent input validation and error responses across all endpoints.
 */

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Validates request body against a Zod schema
 * Returns parsed data on success, or NextResponse with 400 error on failure
 */
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: NextResponse }> {
  try {
    const body = await request.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))

      return {
        success: false,
        response: validationError(errors),
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    return {
      success: false,
      response: invalidJson(),
    }
  }
}

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

// Pagination parameters
export const paginationSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
})

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).optional(),
  photoURL: z.string().url().max(1000).optional(),
}).refine(
  (data) => data.name !== undefined || data.email !== undefined || data.photoURL !== undefined,
  {
    message: 'At least one field must be provided: name, email, or photoURL',
  }
)

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().max(1000).optional(),
  color: z.string().max(50).optional(),
  icon: z.string().max(50).optional(),
  settings: z.record(z.unknown()).optional(),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  settings: z.record(z.unknown()).optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'At least one field must be provided',
  }
)

// ============================================================================
// SESSION SCHEMAS
// ============================================================================

export const createSessionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).optional(),
})

// ============================================================================
// CHAT SCHEMAS
// ============================================================================

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system'], {
    errorMap: () => ({ message: 'Role must be one of: user, assistant, system' })
  }),
  content: z.string().min(1, 'Content is required').max(50000, 'Content is too long'),
  metadata: z.record(z.unknown()).optional(),
})

export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message is required').max(10000, 'Message is too long'),
  data: z.array(z.record(z.unknown())).optional(),
  dataSchema: z.record(z.unknown()).optional().nullable(),
  fileName: z.string().max(500).optional().nullable(),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).max(50, 'Conversation history is too long').optional(),
  preferredChartType: z.string().max(50).optional(),
  selectedChart: z.object({
    title: z.string(),
    type: z.string(),
    dataKey: z.array(z.string()),
    description: z.string().optional(),
  }).optional().nullable(),
  granularity: z.string().max(50).optional(),
  dashboardFilters: z.array(z.object({
    column: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).optional(),
})

// ============================================================================
// ANALYZE SCHEMAS
// ============================================================================

export const analyzeRequestSchema = z.object({
  data: z.array(z.record(z.unknown()))
    .min(1, 'Data array must contain at least one row')
    .max(10000, 'Data exceeds maximum allowed rows (10,000)'),
  schema: z.object({
    fileName: z.string().optional(),
    fileSize: z.number().optional(),
    columnCount: z.number().optional(),
    rowCount: z.number().optional(),
    columns: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string().optional(),
      uniqueValues: z.number().optional(),
      nullPercentage: z.number().optional(),
      stats: z.record(z.unknown()).optional(),
      suggestedUsage: z.string().optional(),
    })).optional(),
    businessContext: z.string().optional(),
    relationships: z.array(z.string()).optional(),
  }).optional().nullable(),
  correctedSchema: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    userCorrected: z.boolean(),
  })).optional(),
  feedback: z.string().max(5000).optional(),
  fileName: z.string().max(500).optional(),
})

// Validate data array doesn't exceed size limits
export const validateDataSize = (data: unknown[]): boolean => {
  const jsonSize = JSON.stringify(data).length
  const MAX_SIZE = 10 * 1024 * 1024 // 10MB
  return jsonSize <= MAX_SIZE
}

// ============================================================================
// PROJECT CONFIG SCHEMAS
// ============================================================================

export const updateProjectConfigSchema = z.object({
  config: z.record(z.unknown()),
})

// ============================================================================
// PROJECT DATA SCHEMAS
// ============================================================================

export const uploadProjectDataSchema = z.object({
  data: z.array(z.record(z.unknown()))
    .min(1, 'Data array must contain at least one row')
    .max(1000000, 'Data exceeds maximum allowed rows (1,000,000)'),
  analysis: z.record(z.unknown()).optional(),
  chartCustomizations: z.record(z.unknown()).optional(),
  metadata: z.object({
    fileName: z.string()
      .min(1, 'fileName is required')
      .max(255, 'fileName must be less than 255 characters')
      .regex(/^[^<>:"/\\|?*\x00-\x1F]+$/, 'fileName contains invalid characters'),
    fileSize: z.number()
      .int()
      .nonnegative('fileSize must be non-negative')
      .max(50 * 1024 * 1024, 'fileSize exceeds 50MB limit')
      .optional(),
    mimeType: z.string()
      .regex(/^[a-z]+\/[a-z0-9\-+.]+$/i, 'Invalid MIME type format')
      .optional(),
  }),
  version: z.number().int().positive().optional(),
})

// ============================================================================
// PROJECT CHAT SCHEMAS
// ============================================================================

export const projectChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant'], {
    errorMap: () => ({ message: 'Role must be either "user" or "assistant"' })
  }),
  content: z.string().min(1, 'Content is required'),
  metadata: z.record(z.unknown()).optional(),
})

// ============================================================================
// DASHBOARD CONFIG SCHEMAS
// ============================================================================

export const updateDashboardConfigSchema = z.object({
  chartCustomizations: z.record(z.unknown()).optional(),
  currentTheme: z.record(z.unknown()).optional().nullable(),
  currentLayout: z.record(z.unknown()).optional().nullable(),
  dashboardFilters: z.unknown().optional().nullable(),
  dateRange: z.unknown().optional().nullable(),
  granularity: z.string().max(50).optional().nullable(),
  chatMessages: z.array(z.unknown()).optional().nullable(),
})

// ============================================================================
// USER PROFILE SCHEMAS
// ============================================================================

export const updateUserProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(255),
  photoURL: z.string().url().max(1000).optional(),
})

// ============================================================================
// SESSION UPDATE SCHEMA
// ============================================================================

export const updateSessionSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
}).refine(
  (data) => data.name !== undefined || data.description !== undefined,
  {
    message: 'At least one field must be provided: name or description',
  }
)

// ============================================================================
// SESSION DATA SCHEMAS
// ============================================================================

export const sessionDataSchema = z.object({
  type: z.enum(['file', 'analysis'], {
    errorMap: () => ({ message: 'Type must be either "file" or "analysis"' })
  }),
  data: z.unknown(),
})

// ============================================================================
// ANALYZE SIMPLE SCHEMAS
// ============================================================================

export const analyzeSimpleRequestSchema = z.object({
  data: z.array(z.record(z.unknown()))
    .min(1, 'Data array must contain at least one row')
    .max(10000, 'Data exceeds maximum allowed rows (10,000)'),
})

// ============================================================================
// CHART TITLE GENERATION SCHEMAS
// ============================================================================

export const generateChartTitleRequestSchema = z.object({
  chartType: z.string().min(1, 'Chart type is required'),
  dataMapping: z.object({
    xAxis: z.string().optional(),
    yAxis: z.union([z.string(), z.array(z.string())]).optional(),
    category: z.string().optional(),
    value: z.string().optional(),
    metric: z.string().optional(),
    values: z.array(z.string()).optional(),
    aggregation: z.string().optional(),
  }).passthrough().optional(),
  sampleData: z.array(z.record(z.unknown())).optional(),
  dataSchema: z.array(z.object({
    name: z.string(),
    type: z.string(),
  })).optional(),
})

// ============================================================================
// RECOMMENDATIONS REFRESH SCHEMAS
// ============================================================================

export const recommendationsRefreshRequestSchema = z.object({
  dataId: z.string().optional(),
  data: z.array(z.record(z.unknown()))
    .min(1, 'Data array must contain at least one row')
    .optional(),
  schema: z.record(z.unknown()).optional(),
  correctedSchema: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    userCorrected: z.boolean().optional(),
  })).optional(),
  filters: z.array(z.object({
    chartType: z.string(),
    dataColumns: z.array(z.string()),
  })).optional(),
  excludedTypes: z.array(z.string()).optional(),
  focus: z.enum(['trends', 'comparisons', 'distributions', 'kpis', 'all']).optional(),
  limit: z.number().int().positive().max(50).optional(),
  activeFilters: z.array(z.object({
    column: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).optional(),
}).refine(
  (data) => data.data !== undefined && Array.isArray(data.data) && data.data.length > 0,
  {
    message: 'Data array is required and must contain at least one row',
  }
)

// ============================================================================
// SESSION DATA POST SCHEMAS
// ============================================================================

export const sessionDataPostSchema = z.object({
  type: z.enum(['file', 'analysis'], {
    errorMap: () => ({ message: 'Type must be either "file" or "analysis"' })
  }),
  data: z.union([
    z.object({
      file: z.record(z.unknown()),
      parsedData: z.array(z.record(z.unknown())),
    }),
    z.object({
      analysis: z.record(z.unknown()),
      fileId: z.string(),
    }),
  ]),
})

// ============================================================================
// AUTH SESSION SCHEMAS
// ============================================================================

export const createAuthSessionSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
})

// ============================================================================
// MONITORING SCHEMAS
// ============================================================================

export const monitoringDataSchema = z.object({
  type: z.enum(['error', 'performance', 'event'], {
    errorMap: () => ({ message: 'Type must be one of: error, performance, event' })
  }),
  data: z.unknown(),
})

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type UpdateUserInput = z.infer<typeof updateUserSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type CreateSessionInput = z.infer<typeof createSessionSchema>
export type ChatMessageInput = z.infer<typeof chatMessageSchema>
export type ChatRequestInput = z.infer<typeof chatRequestSchema>
export type AnalyzeRequestInput = z.infer<typeof analyzeRequestSchema>
export type UpdateProjectConfigInput = z.infer<typeof updateProjectConfigSchema>
export type UploadProjectDataInput = z.infer<typeof uploadProjectDataSchema>
export type ProjectChatMessageInput = z.infer<typeof projectChatMessageSchema>
export type UpdateDashboardConfigInput = z.infer<typeof updateDashboardConfigSchema>
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>
export type SessionDataInput = z.infer<typeof sessionDataSchema>
export type AnalyzeSimpleRequestInput = z.infer<typeof analyzeSimpleRequestSchema>
export type GenerateChartTitleRequestInput = z.infer<typeof generateChartTitleRequestSchema>
export type RecommendationsRefreshRequestInput = z.infer<typeof recommendationsRefreshRequestSchema>
export type SessionDataPostInput = z.infer<typeof sessionDataPostSchema>
export type CreateAuthSessionInput = z.infer<typeof createAuthSessionSchema>
export type MonitoringDataInput = z.infer<typeof monitoringDataSchema>
