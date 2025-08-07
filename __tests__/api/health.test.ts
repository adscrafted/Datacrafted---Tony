/**
 * @jest-environment node
 */

import { GET } from '@/app/api/health/route'
import { db } from '@/lib/db'

// Mock the database
jest.mock('@/lib/db', () => ({
  db: {
    $queryRaw: jest.fn(),
  },
}))

const mockDb = db as jest.Mocked<typeof db>

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variables
    delete process.env.OPENAI_API_KEY
    delete process.env.DATABASE_URL
  })

  it('returns healthy status when all checks pass', async () => {
    // Mock successful database query
    mockDb.$queryRaw.mockResolvedValue([{ '1': 1 }])
    
    // Set required environment variables
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.DATABASE_URL = 'postgresql://test'
    
    const response = await GET()
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.checks.database).toBe('healthy')
    expect(data.checks.environment).toBe('healthy')
    expect(data.checks.openai).toBe('configured')
  })

  it('returns unhealthy status when database fails', async () => {
    // Mock database failure
    mockDb.$queryRaw.mockRejectedValue(new Error('Database connection failed'))
    
    // Set required environment variables
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.DATABASE_URL = 'postgresql://test'
    
    const response = await GET()
    const data = await response.json()
    
    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.checks.database).toBe('unhealthy')
    expect(data.error).toContain('Database connection failed')
  })

  it('returns unhealthy status when environment variables are missing', async () => {
    // Mock successful database query
    mockDb.$queryRaw.mockResolvedValue([{ '1': 1 }])
    
    // Don't set OPENAI_API_KEY
    process.env.DATABASE_URL = 'postgresql://test'
    
    const response = await GET()
    const data = await response.json()
    
    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.checks.database).toBe('healthy')
    expect(data.checks.environment).toBe('unhealthy')
    expect(data.missingEnvVars).toContain('OPENAI_API_KEY')
  })

  it('returns configured openai status when API key is present', async () => {
    // Mock successful database query
    mockDb.$queryRaw.mockResolvedValue([{ '1': 1 }])
    
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.DATABASE_URL = 'postgresql://test'
    
    const response = await GET()
    const data = await response.json()
    
    expect(data.checks.openai).toBe('configured')
  })

  it('returns missing openai status when API key is not present', async () => {
    // Mock successful database query
    mockDb.$queryRaw.mockResolvedValue([{ '1': 1 }])
    
    process.env.DATABASE_URL = 'postgresql://test'
    // Don't set OPENAI_API_KEY
    
    const response = await GET()
    const data = await response.json()
    
    expect(response.status).toBe(503)
    expect(data.checks.openai).toBe('missing')
  })

  it('includes version and environment information', async () => {
    // Mock successful database query
    mockDb.$queryRaw.mockResolvedValue([{ '1': 1 }])
    
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.DATABASE_URL = 'postgresql://test'
    process.env.NODE_ENV = 'production'
    process.env.npm_package_version = '1.0.0'
    
    const response = await GET()
    const data = await response.json()
    
    expect(data.version).toBe('1.0.0')
    expect(data.environment).toBe('production')
    expect(data.timestamp).toBeDefined()
  })

  it('handles multiple missing environment variables', async () => {
    // Mock successful database query but no env vars
    mockDb.$queryRaw.mockResolvedValue([{ '1': 1 }])
    
    const response = await GET()
    const data = await response.json()
    
    expect(response.status).toBe(503)
    expect(data.checks.environment).toBe('unhealthy')
    expect(data.missingEnvVars).toContain('OPENAI_API_KEY')
    expect(data.missingEnvVars).toContain('DATABASE_URL')
  })
})