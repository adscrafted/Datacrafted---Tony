// IndexedDB storage for large datasets
const DB_NAME = 'DatacraftedDB'
const DB_VERSION = 1
const STORE_NAME = 'datasets'

interface StoredDataset {
  id: string
  fileName: string
  data: any[]
  timestamp: number
}

class DataStorage {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('fileName', 'fileName', { unique: false })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  async saveData(fileName: string, data: any[]): Promise<string> {
    if (!this.db) await this.init()
    
    const id = `${fileName}_${Date.now()}`
    const dataset: StoredDataset = {
      id,
      fileName,
      data,
      timestamp: Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(dataset)

      request.onsuccess = () => resolve(id)
      request.onerror = () => reject(request.error)
    })
  }

  async loadData(id: string): Promise<any[] | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => {
        const result = request.result as StoredDataset | undefined
        resolve(result ? result.data : null)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async loadLatestData(fileName: string): Promise<any[] | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('fileName')
      const request = index.getAll(fileName)

      request.onsuccess = () => {
        const results = request.result as StoredDataset[]
        if (results.length === 0) {
          resolve(null)
        } else {
          // Get the most recent dataset
          const latest = results.sort((a, b) => b.timestamp - a.timestamp)[0]
          resolve(latest.data)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  async deleteData(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getStorageSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return estimate.usage || 0
    }
    return 0
  }
}

export const dataStorage = new DataStorage()