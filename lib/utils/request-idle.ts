/**
 * Utility for scheduling non-critical work during idle time
 */

interface IdleTask {
  id: string
  priority: 'high' | 'medium' | 'low'
  task: () => void | Promise<void>
}

class IdleTaskScheduler {
  private queue: Map<string, IdleTask> = new Map()
  private isProcessing = false
  private idleCallbackId: number | null = null

  /**
   * Schedule a task to run during idle time
   */
  schedule(id: string, task: () => void | Promise<void>, priority: 'high' | 'medium' | 'low' = 'medium') {
    this.queue.set(id, { id, task, priority })
    this.processQueue()
  }

  /**
   * Cancel a scheduled task
   */
  cancel(id: string) {
    this.queue.delete(id)
  }

  /**
   * Clear all scheduled tasks
   */
  clear() {
    this.queue.clear()
    if (this.idleCallbackId !== null) {
      cancelIdleCallback(this.idleCallbackId)
      this.idleCallbackId = null
    }
  }

  private processQueue() {
    if (this.isProcessing || this.queue.size === 0) return

    this.isProcessing = true

    if ('requestIdleCallback' in window) {
      this.idleCallbackId = requestIdleCallback(
        (deadline) => this.processTasks(deadline),
        { timeout: 1000 } // Max wait time
      )
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => this.processTasks(), 0)
    }
  }

  private async processTasks(deadline?: IdleDeadline) {
    const tasks = Array.from(this.queue.values())
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      })

    for (const { id, task } of tasks) {
      // Check if we have time remaining
      if (deadline && deadline.timeRemaining() <= 0) {
        break
      }

      this.queue.delete(id)
      
      try {
        await task()
      } catch (error) {
        console.error(`Idle task ${id} failed:`, error)
      }
    }

    this.isProcessing = false

    // Continue processing if there are more tasks
    if (this.queue.size > 0) {
      this.processQueue()
    }
  }
}

// Singleton instance
export const idleScheduler = new IdleTaskScheduler()

/**
 * Schedule a function to run during idle time
 */
export function scheduleIdleTask(
  id: string,
  task: () => void | Promise<void>,
  priority: 'high' | 'medium' | 'low' = 'medium'
) {
  idleScheduler.schedule(id, task, priority)
}

/**
 * Cancel a scheduled idle task
 */
export function cancelIdleTask(id: string) {
  idleScheduler.cancel(id)
}

/**
 * Run a function when idle with a promise interface
 */
export function runWhenIdle<T>(
  task: () => T | Promise<T>,
  timeout = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(
        async () => {
          try {
            const result = await task()
            resolve(result)
          } catch (error) {
            reject(error)
          }
        },
        { timeout }
      )
    } else {
      // Fallback
      setTimeout(async () => {
        try {
          const result = await task()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, 0)
    }
  })
}