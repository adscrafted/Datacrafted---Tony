/**
 * Database Utilities for Connection Pool Monitoring and Query Performance
 *
 * This file provides utilities for monitoring Prisma connection pool status,
 * identifying slow queries, and optimizing database performance.
 */

import { db } from './db'
import { monitoring } from './monitoring'

/**
 * Check database connection health
 * Returns true if database is reachable, false otherwise
 */
export async function checkDatabaseHealth(): Promise<{
  healthy: boolean
  latencyMs?: number
  error?: string
}> {
  const startTime = Date.now()

  try {
    // Simple query to check database connectivity
    await db.$queryRaw`SELECT 1 as health_check`
    const latencyMs = Date.now() - startTime

    return {
      healthy: true,
      latencyMs
    }
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get PostgreSQL connection pool statistics
 * This queries pg_stat_activity to get current connection information
 *
 * Note: Requires SELECT permission on pg_stat_activity
 */
export async function getConnectionPoolStats(): Promise<{
  total: number
  active: number
  idle: number
  idleInTransaction: number
  waiting: number
  maxConnections: number
}> {
  try {
    // Get current connection counts by state
    const connections = await db.$queryRaw<Array<{
      state: string | null
      count: bigint
    }>>`
      SELECT
        state,
        COUNT(*) as count
      FROM pg_stat_activity
      WHERE datname = current_database()
      GROUP BY state
    `

    // Get max connections setting
    const maxConnectionsResult = await db.$queryRaw<Array<{
      setting: string
    }>>`
      SELECT setting
      FROM pg_settings
      WHERE name = 'max_connections'
    `

    const maxConnections = parseInt(maxConnectionsResult[0]?.setting || '100')

    // Parse connection states
    let active = 0
    let idle = 0
    let idleInTransaction = 0
    let waiting = 0
    let total = 0

    connections.forEach(conn => {
      const count = Number(conn.count)
      total += count

      switch (conn.state) {
        case 'active':
          active = count
          break
        case 'idle':
          idle = count
          break
        case 'idle in transaction':
          idleInTransaction = count
          break
        case null:
          // Background processes
          break
      }
    })

    // Check for waiting queries
    const waitingResult = await db.$queryRaw<Array<{
      count: bigint
    }>>`
      SELECT COUNT(*) as count
      FROM pg_stat_activity
      WHERE wait_event_type IS NOT NULL
        AND wait_event_type != 'Activity'
        AND datname = current_database()
    `
    waiting = Number(waitingResult[0]?.count || 0)

    const stats = {
      total,
      active,
      idle,
      idleInTransaction,
      waiting,
      maxConnections
    }

    // Monitor connection pool metrics
    monitoring.monitorConnectionPool({
      activeConnections: active,
      idleConnections: idle,
      waitingRequests: waiting,
      maxConnections
    })

    return stats
  } catch (error) {
    console.error('[DB Utils] Failed to get connection pool stats:', error)
    throw error
  }
}

/**
 * Get slow queries from PostgreSQL
 * Queries pg_stat_statements for queries slower than threshold
 *
 * Note: Requires pg_stat_statements extension to be enabled
 * Enable with: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
 */
export async function getSlowQueries(thresholdMs: number = 1000): Promise<Array<{
  query: string
  calls: number
  totalTimeMs: number
  avgTimeMs: number
  maxTimeMs: number
  rows: number
}>> {
  try {
    const slowQueries = await db.$queryRaw<Array<{
      query: string
      calls: bigint
      total_exec_time: number
      mean_exec_time: number
      max_exec_time: number
      rows: bigint
    }>>`
      SELECT
        query,
        calls,
        total_exec_time,
        mean_exec_time,
        max_exec_time,
        rows
      FROM pg_stat_statements
      WHERE mean_exec_time > ${thresholdMs}
      ORDER BY mean_exec_time DESC
      LIMIT 20
    `

    return slowQueries.map(q => ({
      query: q.query,
      calls: Number(q.calls),
      totalTimeMs: q.total_exec_time,
      avgTimeMs: q.mean_exec_time,
      maxTimeMs: q.max_exec_time,
      rows: Number(q.rows)
    }))
  } catch (error) {
    // pg_stat_statements might not be enabled
    console.warn('[DB Utils] pg_stat_statements not available:', error)
    return []
  }
}

/**
 * Get table sizes to identify which tables are consuming the most space
 */
export async function getTableSizes(): Promise<Array<{
  tableName: string
  rowCount: number
  totalSizeBytes: number
  totalSizeMB: number
  indexSizeBytes: number
  indexSizeMB: number
}>> {
  try {
    const tableSizes = await db.$queryRaw<Array<{
      table_name: string
      row_count: bigint
      total_size: bigint
      index_size: bigint
    }>>`
      SELECT
        schemaname || '.' || tablename as table_name,
        n_live_tup as row_count,
        pg_total_relation_size(schemaname || '.' || tablename) as total_size,
        pg_indexes_size(schemaname || '.' || tablename) as index_size
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
    `

    return tableSizes.map(t => ({
      tableName: t.table_name,
      rowCount: Number(t.row_count),
      totalSizeBytes: Number(t.total_size),
      totalSizeMB: Number(t.total_size) / (1024 * 1024),
      indexSizeBytes: Number(t.index_size),
      indexSizeMB: Number(t.index_size) / (1024 * 1024)
    }))
  } catch (error) {
    console.error('[DB Utils] Failed to get table sizes:', error)
    throw error
  }
}

/**
 * Get index usage statistics to identify unused indexes
 */
export async function getIndexUsageStats(): Promise<Array<{
  tableName: string
  indexName: string
  indexSize: string
  indexScans: number
  rowsRead: number
  rowsFetched: number
}>> {
  try {
    const indexStats = await db.$queryRaw<Array<{
      table_name: string
      index_name: string
      index_size: string
      index_scans: bigint
      rows_read: bigint
      rows_fetched: bigint
    }>>`
      SELECT
        schemaname || '.' || tablename as table_name,
        indexrelname as index_name,
        pg_size_pretty(pg_relation_size(schemaname || '.' || indexrelname)) as index_size,
        idx_scan as index_scans,
        idx_tup_read as rows_read,
        idx_tup_fetch as rows_fetched
      FROM pg_stat_user_indexes
      ORDER BY idx_scan ASC, pg_relation_size(schemaname || '.' || indexrelname) DESC
      LIMIT 50
    `

    return indexStats.map(i => ({
      tableName: i.table_name,
      indexName: i.index_name,
      indexSize: i.index_size,
      indexScans: Number(i.index_scans),
      rowsRead: Number(i.rows_read),
      rowsFetched: Number(i.rows_fetched)
    }))
  } catch (error) {
    console.error('[DB Utils] Failed to get index usage stats:', error)
    throw error
  }
}

/**
 * Wrapper for Prisma queries with automatic performance monitoring
 *
 * Usage:
 * const users = await withQueryMonitoring(
 *   'findMany',
 *   'User',
 *   () => db.user.findMany({ where: { active: true } })
 * )
 */
export async function withQueryMonitoring<T>(
  operation: string,
  model: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()

  try {
    const result = await queryFn()
    const durationMs = Date.now() - startTime

    // Determine record count if result is an array
    const recordCount = Array.isArray(result) ? result.length : undefined

    // Monitor query performance
    monitoring.monitorDatabaseQuery(operation, model, durationMs, recordCount)

    return result
  } catch (error) {
    const durationMs = Date.now() - startTime
    monitoring.monitorDatabaseQuery(operation, model, durationMs)
    throw error
  }
}

/**
 * Reset pg_stat_statements (useful after fixing slow queries)
 * Note: Requires superuser or pg_stat_statements_reset permission
 */
export async function resetQueryStats(): Promise<void> {
  try {
    await db.$executeRaw`SELECT pg_stat_statements_reset()`
    console.log('[DB Utils] Query statistics reset successfully')
  } catch (error) {
    console.error('[DB Utils] Failed to reset query stats:', error)
    throw error
  }
}

/**
 * Get active queries currently running on the database
 */
export async function getActiveQueries(): Promise<Array<{
  pid: number
  duration: string
  state: string
  query: string
  waitEvent: string | null
}>> {
  try {
    const activeQueries = await db.$queryRaw<Array<{
      pid: number
      duration: string
      state: string
      query: string
      wait_event: string | null
    }>>`
      SELECT
        pid,
        now() - query_start as duration,
        state,
        query,
        wait_event
      FROM pg_stat_activity
      WHERE state != 'idle'
        AND query NOT LIKE '%pg_stat_activity%'
        AND datname = current_database()
      ORDER BY query_start ASC
    `

    return activeQueries.map(q => ({
      pid: q.pid,
      duration: q.duration,
      state: q.state,
      query: q.query,
      waitEvent: q.wait_event
    }))
  } catch (error) {
    console.error('[DB Utils] Failed to get active queries:', error)
    throw error
  }
}

/**
 * Kill a long-running query by PID
 * Use with caution!
 */
export async function killQuery(pid: number): Promise<void> {
  try {
    await db.$executeRaw`SELECT pg_terminate_backend(${pid})`
    console.log(`[DB Utils] Query with PID ${pid} terminated`)
  } catch (error) {
    console.error(`[DB Utils] Failed to terminate query ${pid}:`, error)
    throw error
  }
}

/**
 * Generate a comprehensive database health report
 */
export async function generateHealthReport(): Promise<{
  health: Awaited<ReturnType<typeof checkDatabaseHealth>>
  connectionPool: Awaited<ReturnType<typeof getConnectionPoolStats>>
  tableSizes: Awaited<ReturnType<typeof getTableSizes>>
  activeQueries: Awaited<ReturnType<typeof getActiveQueries>>
  timestamp: string
}> {
  const [health, connectionPool, tableSizes, activeQueries] = await Promise.all([
    checkDatabaseHealth(),
    getConnectionPoolStats(),
    getTableSizes(),
    getActiveQueries()
  ])

  return {
    health,
    connectionPool,
    tableSizes,
    activeQueries,
    timestamp: new Date().toISOString()
  }
}
