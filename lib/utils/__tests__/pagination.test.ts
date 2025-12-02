/**
 * Pagination Utility Tests
 *
 * Tests for pagination helper functions
 */

import {
  parsePaginationParams,
  createPaginatedResponse,
  createPaginatedResponseFromQuery,
  getPrismaSkipTake,
  isPaginationRequested,
  PAGINATION_DEFAULTS,
} from '../pagination'

describe('parsePaginationParams', () => {
  it('should return default values when no params provided', () => {
    const searchParams = new URLSearchParams()
    const result = parsePaginationParams(searchParams)

    expect(result).toEqual({
      page: PAGINATION_DEFAULTS.PAGE,
      pageSize: PAGINATION_DEFAULTS.PAGE_SIZE,
    })
  })

  it('should parse valid page and pageSize params', () => {
    const searchParams = new URLSearchParams('page=2&pageSize=50')
    const result = parsePaginationParams(searchParams)

    expect(result).toEqual({
      page: 2,
      pageSize: 50,
    })
  })

  it('should parse limit param as pageSize', () => {
    const searchParams = new URLSearchParams('page=3&limit=10')
    const result = parsePaginationParams(searchParams)

    expect(result).toEqual({
      page: 3,
      pageSize: 10,
    })
  })

  it('should enforce maximum page size', () => {
    const searchParams = new URLSearchParams('pageSize=500')
    const result = parsePaginationParams(searchParams)

    expect(result.pageSize).toBe(PAGINATION_DEFAULTS.MAX_PAGE_SIZE)
  })

  it('should enforce minimum page number of 1', () => {
    const searchParams = new URLSearchParams('page=-5')
    const result = parsePaginationParams(searchParams)

    expect(result.page).toBe(1)
  })

  it('should enforce minimum page size of 1', () => {
    const searchParams = new URLSearchParams('pageSize=0')
    const result = parsePaginationParams(searchParams)

    expect(result.pageSize).toBe(1)
  })

  it('should handle invalid numeric values gracefully', () => {
    const searchParams = new URLSearchParams('page=abc&pageSize=xyz')
    const result = parsePaginationParams(searchParams)

    expect(result).toEqual({
      page: PAGINATION_DEFAULTS.PAGE,
      pageSize: PAGINATION_DEFAULTS.PAGE_SIZE,
    })
  })
})

describe('isPaginationRequested', () => {
  it('should return true when page param is present', () => {
    const searchParams = new URLSearchParams('page=1')
    expect(isPaginationRequested(searchParams)).toBe(true)
  })

  it('should return true when limit param is present', () => {
    const searchParams = new URLSearchParams('limit=10')
    expect(isPaginationRequested(searchParams)).toBe(true)
  })

  it('should return true when pageSize param is present', () => {
    const searchParams = new URLSearchParams('pageSize=20')
    expect(isPaginationRequested(searchParams)).toBe(true)
  })

  it('should return false when no pagination params are present', () => {
    const searchParams = new URLSearchParams('sort=name&filter=active')
    expect(isPaginationRequested(searchParams)).toBe(false)
  })

  it('should return false for empty params', () => {
    const searchParams = new URLSearchParams()
    expect(isPaginationRequested(searchParams)).toBe(false)
  })
})

describe('createPaginatedResponse', () => {
  const mockData = Array.from({ length: 50 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
  }))

  it('should paginate data correctly for first page', () => {
    const result = createPaginatedResponse(mockData, { page: 1, pageSize: 10 })

    expect(result.data).toHaveLength(10)
    expect(result.data[0].id).toBe('item-1')
    expect(result.data[9].id).toBe('item-10')
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 50,
      totalPages: 5,
      hasMore: true,
    })
  })

  it('should paginate data correctly for middle page', () => {
    const result = createPaginatedResponse(mockData, { page: 3, pageSize: 10 })

    expect(result.data).toHaveLength(10)
    expect(result.data[0].id).toBe('item-21')
    expect(result.data[9].id).toBe('item-30')
    expect(result.pagination.hasMore).toBe(true)
  })

  it('should paginate data correctly for last page', () => {
    const result = createPaginatedResponse(mockData, { page: 5, pageSize: 10 })

    expect(result.data).toHaveLength(10)
    expect(result.data[0].id).toBe('item-41')
    expect(result.pagination.hasMore).toBe(false)
  })

  it('should handle partial last page', () => {
    const result = createPaginatedResponse(mockData, { page: 3, pageSize: 20 })

    expect(result.data).toHaveLength(10) // Only 10 items left
    expect(result.pagination).toEqual({
      page: 3,
      pageSize: 20,
      total: 50,
      totalPages: 3,
      hasMore: false,
    })
  })

  it('should return empty data for page beyond total pages', () => {
    const result = createPaginatedResponse(mockData, { page: 10, pageSize: 10 })

    expect(result.data).toHaveLength(0)
    expect(result.pagination.hasMore).toBe(false)
  })

  it('should handle empty data array', () => {
    const result = createPaginatedResponse([], { page: 1, pageSize: 10 })

    expect(result.data).toHaveLength(0)
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
      hasMore: false,
    })
  })

  it('should handle single page of data', () => {
    const smallData = mockData.slice(0, 5)
    const result = createPaginatedResponse(smallData, { page: 1, pageSize: 10 })

    expect(result.data).toHaveLength(5)
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 5,
      totalPages: 1,
      hasMore: false,
    })
  })
})

describe('createPaginatedResponseFromQuery', () => {
  const mockData = Array.from({ length: 10 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `Item ${i + 1}`,
  }))

  it('should create paginated response with provided total', () => {
    const result = createPaginatedResponseFromQuery(50, mockData, {
      page: 1,
      pageSize: 10,
    })

    expect(result.data).toHaveLength(10)
    expect(result.pagination).toEqual({
      page: 1,
      pageSize: 10,
      total: 50,
      totalPages: 5,
      hasMore: true,
    })
  })

  it('should handle last page correctly', () => {
    const result = createPaginatedResponseFromQuery(50, mockData, {
      page: 5,
      pageSize: 10,
    })

    expect(result.pagination.hasMore).toBe(false)
  })

  it('should calculate totalPages correctly', () => {
    const result = createPaginatedResponseFromQuery(45, mockData, {
      page: 1,
      pageSize: 10,
    })

    expect(result.pagination.totalPages).toBe(5)
  })
})

describe('getPrismaSkipTake', () => {
  it('should calculate skip and take for first page', () => {
    const result = getPrismaSkipTake({ page: 1, pageSize: 10 })

    expect(result).toEqual({
      skip: 0,
      take: 10,
    })
  })

  it('should calculate skip and take for second page', () => {
    const result = getPrismaSkipTake({ page: 2, pageSize: 10 })

    expect(result).toEqual({
      skip: 10,
      take: 10,
    })
  })

  it('should calculate skip and take for middle page', () => {
    const result = getPrismaSkipTake({ page: 5, pageSize: 20 })

    expect(result).toEqual({
      skip: 80,
      take: 20,
    })
  })

  it('should handle large page numbers', () => {
    const result = getPrismaSkipTake({ page: 100, pageSize: 50 })

    expect(result).toEqual({
      skip: 4950,
      take: 50,
    })
  })
})

describe('Integration scenarios', () => {
  it('should work end-to-end for typical API usage', () => {
    // Simulate API request
    const searchParams = new URLSearchParams('page=2&pageSize=20')

    // Parse params
    const params = parsePaginationParams(searchParams)
    expect(params).toEqual({ page: 2, pageSize: 20 })

    // Use for database query
    const { skip, take } = getPrismaSkipTake(params)
    expect(skip).toBe(20)
    expect(take).toBe(20)

    // Simulate database results
    const mockResults = Array.from({ length: 20 }, (_, i) => ({
      id: `item-${i + 21}`,
    }))
    const total = 150

    // Create response
    const response = createPaginatedResponseFromQuery(total, mockResults, params)

    expect(response.data).toHaveLength(20)
    expect(response.pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 150,
      totalPages: 8,
      hasMore: true,
    })
  })

  it('should handle backward compatibility scenario', () => {
    // Old API usage without pagination
    const searchParams = new URLSearchParams()

    // Check if pagination is requested
    const isPaginated = isPaginationRequested(searchParams)
    expect(isPaginated).toBe(false)

    // In this case, API would return legacy response format
    // No pagination metadata included
  })
})
