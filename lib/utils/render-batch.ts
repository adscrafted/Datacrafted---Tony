/**
 * Batch rendering utilities for optimal performance
 */

interface BatchRenderOptions {
  batchSize?: number
  delay?: number
  priority?: 'high' | 'normal' | 'low'
}

class RenderBatcher {
  private queue: Map<string, () => void> = new Map()
  private frameId: number | null = null
  private processing = false

  /**
   * Add a render task to the batch queue
   */
  add(id: string, task: () => void) {
    this.queue.set(id, task)
    this.scheduleFlush()
  }

  /**
   * Remove a render task from the queue
   */
  remove(id: string) {
    this.queue.delete(id)
  }

  /**
   * Clear all pending render tasks
   */
  clear() {
    this.queue.clear()
    if (this.frameId) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }

  private scheduleFlush() {
    if (this.frameId || this.processing) return

    this.frameId = requestAnimationFrame(() => {
      this.flush()
    })
  }

  private flush() {
    if (this.processing) return
    
    this.processing = true
    this.frameId = null

    // Process all queued tasks
    const tasks = Array.from(this.queue.values())
    this.queue.clear()

    // Execute tasks in batches to prevent blocking
    const executeBatch = (index: number) => {
      const batchSize = 5 // Process 5 tasks per frame
      const end = Math.min(index + batchSize, tasks.length)

      for (let i = index; i < end; i++) {
        try {
          tasks[i]()
        } catch (error) {
          console.error('Batch render error:', error)
        }
      }

      if (end < tasks.length) {
        requestAnimationFrame(() => executeBatch(end))
      } else {
        this.processing = false
      }
    }

    executeBatch(0)
  }
}

// Global batcher instance
const batcher = new RenderBatcher()

/**
 * Batch multiple render operations together
 */
export function batchRender(id: string, task: () => void) {
  batcher.add(id, task)
}

/**
 * Cancel a batched render
 */
export function cancelBatchRender(id: string) {
  batcher.remove(id)
}

/**
 * Execute a function with batched DOM updates
 */
export function batchedUpdates<T>(fn: () => T): T {
  // In React 18+, this is automatic, but we can still optimize
  if ('startTransition' in React) {
    let result: T
    (React as any).startTransition(() => {
      result = fn()
    })
    return result!
  }
  return fn()
}

/**
 * Defer expensive computations to the next tick
 */
export function deferComputation<T>(
  computation: () => T,
  fallback?: T
): Promise<T> {
  return new Promise((resolve) => {
    // Use MessageChannel for faster than setTimeout(0)
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      try {
        resolve(computation())
      } catch (error) {
        console.error('Deferred computation error:', error)
        resolve(fallback as T)
      }
    }
    channel.port2.postMessage(null)
  })
}

/**
 * Split rendering across multiple frames
 */
export async function* frameByFrame<T>(
  items: T[],
  batchSize = 10
): AsyncGenerator<T[], void> {
  for (let i = 0; i < items.length; i += batchSize) {
    yield items.slice(i, i + batchSize)
    
    // Wait for next frame
    await new Promise(resolve => requestAnimationFrame(resolve))
  }
}