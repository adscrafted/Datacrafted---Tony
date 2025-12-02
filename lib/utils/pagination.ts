/**
 * Pagination Utility
 *
 * Provides type-safe pagination helpers for API endpoints.
 * Supports flexible pagination with sensible defaults and maximum limits.
 */

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const

/**
 * Pagination parameters from request
 */
export interface PaginationParams {
  page: number
  pageSize: number
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

/**
 * Paginated API response structure
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationMeta
}

/**
 * Parse pagination parameters from URL search params
 *
 * @param searchParams - URL search parameters from Next.js request
 * @returns Validated pagination parameters with defaults applied
 *
 * @example
 * const { page, pageSize } = parsePaginationParams(request.nextUrl.searchParams)
 */
export function parsePaginationParams(
  searchParams: URLSearchParams
): PaginationParams {
  // Parse page number (default: 1, min: 1)
  const pageParam = searchParams.get('page')
  const page = Math.max(1, parseInt(pageParam || String(PAGINATION_DEFAULTS.PAGE), 10) || PAGINATION_DEFAULTS.PAGE)

  // Parse page size (support both 'limit' and 'pageSize' params)
  // 'limit' is common in REST APIs, 'pageSize' is more explicit
  const limitParam = searchParams.get('limit') || searchParams.get('pageSize')
  const requestedPageSize = parseInt(limitParam || String(PAGINATION_DEFAULTS.PAGE_SIZE), 10) || PAGINATION_DEFAULTS.PAGE_SIZE

  // Enforce max page size limit
  const pageSize = Math.min(
    Math.max(1, requestedPageSize),
    PAGINATION_DEFAULTS.MAX_PAGE_SIZE
  )

  return { page, pageSize }
}

/**
 * Calculate pagination metadata and slice data
 *
 * @param data - Full array of items to paginate
 * @param params - Pagination parameters (page, pageSize)
 * @returns Paginated response with sliced data and metadata
 *
 * @example
 * const result = createPaginatedResponse(allProjects, { page: 1, pageSize: 20 })
 */
export function createPaginatedResponse<T>(
  data: T[],
  params: PaginationParams
): PaginatedResponse<T> {
  const { page, pageSize } = params
  const total = data.length
  const totalPages = Math.ceil(total / pageSize)

  // Calculate offset and slice data
  const offset = (page - 1) * pageSize
  const paginatedData = data.slice(offset, offset + pageSize)

  return {
    data: paginatedData,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

/**
 * Check if pagination is requested in the URL
 * Returns true if either 'page', 'limit', or 'pageSize' params are present
 *
 * @param searchParams - URL search parameters
 * @returns Boolean indicating if pagination was requested
 *
 * @example
 * const isPaginated = isPaginationRequested(request.nextUrl.searchParams)
 */
export function isPaginationRequested(searchParams: URLSearchParams): boolean {
  return searchParams.has('page') ||
         searchParams.has('limit') ||
         searchParams.has('pageSize')
}

/**
 * Create paginated response from database query parameters
 * Useful when you want to paginate at the database level for efficiency
 *
 * @param total - Total count from database
 * @param data - Sliced data from database
 * @param params - Pagination parameters used in query
 * @returns Paginated response structure
 *
 * @example
 * const total = await db.projects.count({ where: { userId } })
 * const projects = await db.projects.findMany({
 *   where: { userId },
 *   skip: (page - 1) * pageSize,
 *   take: pageSize
 * })
 * return createPaginatedResponseFromQuery(total, projects, { page, pageSize })
 */
export function createPaginatedResponseFromQuery<T>(
  total: number,
  data: T[],
  params: PaginationParams
): PaginatedResponse<T> {
  const { page, pageSize } = params
  const totalPages = Math.ceil(total / pageSize)

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  }
}

/**
 * Calculate skip and take values for Prisma queries
 *
 * @param params - Pagination parameters
 * @returns Object with skip and take values for Prisma
 *
 * @example
 * const { skip, take } = getPrismaSkipTake({ page: 2, pageSize: 20 })
 * const data = await db.projects.findMany({ skip, take })
 */
export function getPrismaSkipTake(params: PaginationParams): {
  skip: number
  take: number
} {
  const { page, pageSize } = params
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}
