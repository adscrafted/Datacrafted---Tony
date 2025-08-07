import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface ProjectCacheDB extends DBSchema {
  projectCache: {
    key: string
    value: {
      projectId: string
      timestamp: number
      fileName: string
      analysis: any
      dataSchema: any
      rowCount: number
    }
  }
}

let db: IDBPDatabase<ProjectCacheDB> | null = null

async function getDB() {
  if (!db) {
    db = await openDB<ProjectCacheDB>('project-cache', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projectCache')) {
          db.createObjectStore('projectCache', { keyPath: 'projectId' })
        }
      }
    })
  }
  return db
}

export const ProjectCache = {
  async get(projectId: string) {
    try {
      const database = await getDB()
      const cached = await database.get('projectCache', projectId)
      
      if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached
      }
      
      // Clear expired cache
      if (cached) {
        await database.delete('projectCache', projectId)
      }
      
      return null
    } catch (error) {
      console.warn('Failed to get project cache:', error)
      return null
    }
  },

  async set(projectId: string, data: {
    fileName: string
    analysis: any
    dataSchema: any
    rowCount: number
  }) {
    try {
      const database = await getDB()
      await database.put('projectCache', {
        projectId,
        timestamp: Date.now(),
        ...data
      })
    } catch (error) {
      console.warn('Failed to cache project data:', error)
    }
  },

  async clear(projectId?: string) {
    try {
      const database = await getDB()
      if (projectId) {
        await database.delete('projectCache', projectId)
      } else {
        await database.clear('projectCache')
      }
    } catch (error) {
      console.warn('Failed to clear project cache:', error)
    }
  }
}