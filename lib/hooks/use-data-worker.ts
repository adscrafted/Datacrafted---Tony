import { useEffect, useRef, useCallback, useState } from 'react'
import { logger } from '@/lib/utils/logger'

interface WorkerMessage {
  type: 'PROCESS_DATA' | 'AGGREGATE_DATA' | 'FILTER_DATA' | 'SAMPLE_DATA'
  data: any
  config?: any
}

interface WorkerResult {
  type: string
  result: any
  error?: string
}

/**
 * Hook for offloading data processing to a Web Worker
 */
export function useDataWorker() {
  const workerRef = useRef<Worker | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    // Create worker only in browser environment
    if (typeof window !== 'undefined' && 'Worker' in window) {
      try {
        // For Next.js, we need to use a different approach
        // Create worker from a Blob URL to avoid build issues
        const workerCode = `
          // Data sampling logic
          function uniformSample(data, targetSize) {
            if (data.length <= targetSize) return data
            
            const step = data.length / targetSize
            const sampled = []
            
            for (let i = 0; i < targetSize; i++) {
              const index = Math.floor(i * step)
              sampled.push(data[index])
            }
            
            return sampled
          }

          // Aggregate data for pie charts
          function aggregateData(data, keyField, valueField) {
            const aggregated = new Map()
            
            data.forEach(row => {
              const key = String(row[keyField] || 'Unknown')
              const value = Number(row[valueField]) || 0
              aggregated.set(key, (aggregated.get(key) || 0) + value)
            })
            
            return Array.from(aggregated.entries())
              .map(([name, value]) => ({ name, value }))
              .sort((a, b) => b.value - a.value)
          }

          // Filter data based on conditions
          function filterData(data, filters) {
            if (!filters || Object.keys(filters).length === 0) return data
            
            return data.filter(row => {
              return Object.entries(filters).every(([key, value]) => {
                if (value === null || value === undefined) return true
                return row[key] === value
              })
            })
          }

          // Message handler
          self.addEventListener('message', (event) => {
            const { type, data, config } = event.data
            
            try {
              let result
              
              switch (type) {
                case 'PROCESS_DATA':
                  result = data
                  break
                  
                case 'AGGREGATE_DATA':
                  result = aggregateData(data, config.keyField, config.valueField)
                  break
                  
                case 'FILTER_DATA':
                  result = filterData(data, config.filters)
                  break
                  
                case 'SAMPLE_DATA':
                  result = uniformSample(data, config.targetSize)
                  break
                  
                default:
                  throw new Error('Unknown message type: ' + type)
              }
              
              self.postMessage({ type, result })
            } catch (error) {
              self.postMessage({ 
                type, 
                result: null, 
                error: error.message || String(error) 
              })
            }
          })
        `

        const blob = new Blob([workerCode], { type: 'application/javascript' })
        const workerUrl = URL.createObjectURL(blob)
        workerRef.current = new Worker(workerUrl)

        logger.debug('[DataWorker] Web Worker created successfully')

        return () => {
          URL.revokeObjectURL(workerUrl)
        }
      } catch (error) {
        logger.error('[DataWorker] Failed to create Web Worker:', error)
      }
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  const processInWorker = useCallback(
    <T = any>(message: WorkerMessage): Promise<T> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          // Fallback to main thread
          logger.debug('[DataWorker] No worker available, processing in main thread')
          
          switch (message.type) {
            case 'SAMPLE_DATA':
              // Simple fallback implementation
              const { data, config } = message
              const targetSize = config?.targetSize || 1000
              const step = Math.max(1, Math.floor(data.length / targetSize))
              const sampled = data.filter((_: any, index: number) => index % step === 0)
              resolve(sampled.slice(0, targetSize) as T)
              break
            default:
              resolve(message.data as T)
          }
          return
        }

        setIsProcessing(true)

        const handleMessage = (event: MessageEvent<WorkerResult>) => {
          if (event.data.type === message.type) {
            workerRef.current?.removeEventListener('message', handleMessage)
            setIsProcessing(false)

            if (event.data.error) {
              reject(new Error(event.data.error))
            } else {
              resolve(event.data.result)
            }
          }
        }

        workerRef.current.addEventListener('message', handleMessage)
        workerRef.current.postMessage(message)

        // Timeout after 5 seconds
        setTimeout(() => {
          workerRef.current?.removeEventListener('message', handleMessage)
          setIsProcessing(false)
          reject(new Error('Worker timeout'))
        }, 5000)
      })
    },
    []
  )

  const sampleData = useCallback(
    <T = any>(data: T[], targetSize: number): Promise<T[]> => {
      return processInWorker<T[]>({
        type: 'SAMPLE_DATA',
        data,
        config: { targetSize }
      })
    },
    [processInWorker]
  )

  const aggregateData = useCallback(
    (data: any[], keyField: string, valueField: string) => {
      return processInWorker({
        type: 'AGGREGATE_DATA',
        data,
        config: { keyField, valueField }
      })
    },
    [processInWorker]
  )

  const filterData = useCallback(
    (data: any[], filters: Record<string, any>) => {
      return processInWorker({
        type: 'FILTER_DATA',
        data,
        config: { filters }
      })
    },
    [processInWorker]
  )

  return {
    isProcessing,
    sampleData,
    aggregateData,
    filterData,
    processInWorker
  }
}