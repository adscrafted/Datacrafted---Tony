// IndexedDB storage for project data
import type { DataRow, AnalysisResult, DataSchema } from '@/lib/store'

interface StoredProjectData {
  id: string
  projectId: string
  rawData: DataRow[]
  analysis: AnalysisResult | null
  dataSchema: DataSchema | null
  timestamp: number
}

class ProjectDataStorage {
  private db: IDBDatabase | null = null
  private dbName = 'datacrafted-projects'
  private storeName = 'project-data'
  private version = 1

  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create object store for project data
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('projectId', 'projectId', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async saveProjectData(
    projectId: string, 
    rawData: DataRow[], 
    analysis?: AnalysisResult, 
    dataSchema?: DataSchema
  ): Promise<string> {
    if (!this.db) await this.init()
    
    const id = `${projectId}_${Date.now()}`
    const projectData: StoredProjectData = {
      id,
      projectId,
      rawData,
      analysis: analysis || null,
      dataSchema: dataSchema || null,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      const request = store.put(projectData)
      
      request.onsuccess = () => resolve(id)
      request.onerror = () => reject(request.error)
    })
  }

  async loadProjectData(projectId: string): Promise<{
    rawData: DataRow[]
    analysis: AnalysisResult | null
    dataSchema: DataSchema | null
  } | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('projectId')
      
      const request = index.getAll(projectId)
      
      request.onsuccess = () => {
        const results = request.result as StoredProjectData[]
        if (results.length === 0) {
          resolve(null)
          return
        }
        
        // Get the latest data for this project
        const latest = results.sort((a, b) => b.timestamp - a.timestamp)[0]
        resolve({
          rawData: latest.rawData,
          analysis: latest.analysis,
          dataSchema: latest.dataSchema
        })
      }
      
      request.onerror = () => reject(request.error)
    })
  }

  async deleteProjectData(projectId: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('projectId')
      
      const request = index.getAllKeys(projectId)
      
      request.onsuccess = () => {
        const keys = request.result
        let deleteCount = 0
        
        if (keys.length === 0) {
          resolve()
          return
        }
        
        keys.forEach(key => {
          const deleteRequest = store.delete(key)
          deleteRequest.onsuccess = () => {
            deleteCount++
            if (deleteCount === keys.length) {
              resolve()
            }
          }
          deleteRequest.onerror = () => reject(deleteRequest.error)
        })
      }
      
      request.onerror = () => reject(request.error)
    })
  }

  async cleanup(): Promise<void> {
    if (!this.db) await this.init()

    // Remove project data older than 30 days
    const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('timestamp')
      
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime))
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }
}

export const projectDataStorage = new ProjectDataStorage()