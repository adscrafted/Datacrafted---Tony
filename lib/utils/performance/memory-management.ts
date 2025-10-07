/**
 * Memory Management Utilities
 *
 * Tools for managing memory efficiently in data-heavy dashboard applications
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * LRU (Least Recently Used) Cache implementation
 * Automatically evicts least recently used items when size limit is reached
 */
export class LRUCache<K, V> {
  private maxSize: number;
  private cache: Map<K, V>;
  private accessOrder: K[];

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);

    if (value !== undefined) {
      // Move to end (most recently used)
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.accessOrder.push(key);
    }

    return value;
  }

  set(key: K, value: V): void {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    }

    // Evict least recently used if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const lruKey = this.accessOrder.shift();
      if (lruKey !== undefined) {
        this.cache.delete(lruKey);
      }
    }

    this.cache.set(key, value);
    this.accessOrder.push(key);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * React hook for LRU cache
 */
export function useLRUCache<K, V>(maxSize: number = 100) {
  const cacheRef = useRef<LRUCache<K, V>>(new LRUCache(maxSize));

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      cacheRef.current.clear();
    };
  }, []);

  return cacheRef.current;
}

/**
 * Debounced function hook with automatic cleanup
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/**
 * Throttled function hook with automatic cleanup
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastRunRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRunRef.current;

      if (timeSinceLastRun >= delay) {
        callbackRef.current(...args);
        lastRunRef.current = now;
      } else {
        // Schedule for later
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args);
          lastRunRef.current = Date.now();
        }, delay - timeSinceLastRun);
      }
    },
    [delay]
  );
}

/**
 * Automatically cleanup large objects when component unmounts
 */
export function useAutoCleanup<T>(value: T): T {
  useEffect(() => {
    return () => {
      // Attempt to free memory
      if (value && typeof value === 'object') {
        Object.keys(value).forEach(key => {
          delete (value as any)[key];
        });
      }
    };
  }, [value]);

  return value;
}

/**
 * Paginated data hook - only keep current page in memory
 */
export function usePaginatedData<T>(
  allData: T[],
  pageSize: number = 100
) {
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = Math.ceil(allData.length / pageSize);

  const currentPageData = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return allData.slice(start, end);
  }, [allData, currentPage, pageSize]);

  return {
    data: currentPageData,
    currentPage,
    totalPages,
    nextPage: () => setCurrentPage(p => Math.min(p + 1, totalPages - 1)),
    prevPage: () => setCurrentPage(p => Math.max(p - 1, 0)),
    goToPage: (page: number) => setCurrentPage(Math.max(0, Math.min(page, totalPages - 1))),
    hasNext: currentPage < totalPages - 1,
    hasPrev: currentPage > 0,
  };
}

/**
 * Virtual scrolling implementation
 * Only renders visible items + buffer
 */
export function useVirtualScroll<T>(
  items: T[],
  options: {
    itemHeight: number;
    containerHeight: number;
    overscan?: number;
  }
) {
  const { itemHeight, containerHeight, overscan = 3 } = options;
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length, visibleEnd + overscan);

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;

  return {
    visibleItems,
    offsetY,
    totalHeight,
    startIndex,
    endIndex,
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
}

/**
 * Weak reference cache - automatically garbage collected
 */
export class WeakCache<K extends object, V> {
  private cache: WeakMap<K, V>;

  constructor() {
    this.cache = new WeakMap();
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }

  set(key: K, value: V): void {
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }
}

/**
 * Object pool for reusing expensive objects
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private inUse: Set<T> = new Set();
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 50
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  acquire(): T {
    let obj = this.available.pop();

    if (!obj) {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  release(obj: T): void {
    if (!this.inUse.has(obj)) return;

    this.inUse.delete(obj);
    this.reset(obj);

    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
  }

  clear(): void {
    this.available = [];
    this.inUse.clear();
  }

  size(): { available: number; inUse: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
    };
  }
}

/**
 * Memory pressure detector
 * Triggers cleanup when memory is running low
 */
export function useMemoryPressure(
  onPressure: (usage: number) => void,
  threshold: number = 0.8
) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('memory' in performance)) return;

    const checkPressure = () => {
      const memory = (performance as any).memory;
      const usage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;

      if (usage > threshold) {
        onPressure(usage);
      }
    };

    const interval = setInterval(checkPressure, 5000);
    checkPressure(); // Check immediately

    return () => clearInterval(interval);
  }, [onPressure, threshold]);
}

/**
 * Automatic garbage collection hint
 * Suggests to browser that GC should run
 */
export function triggerGarbageCollection() {
  if (typeof window !== 'undefined') {
    // Force memory release by creating and discarding large arrays
    const temp: any[] = [];
    for (let i = 0; i < 100; i++) {
      temp.push(new Array(1000).fill(null));
    }
    temp.length = 0;

    // Request idle callback for GC
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // GC hint
      });
    }
  }
}

/**
 * Memory-efficient data structure for chart data
 * Uses typed arrays for numeric data
 */
export class ChartDataBuffer {
  private xData: Float64Array;
  private yData: Float64Array;
  private length: number;

  constructor(capacity: number) {
    this.xData = new Float64Array(capacity);
    this.yData = new Float64Array(capacity);
    this.length = 0;
  }

  push(x: number, y: number): void {
    if (this.length >= this.xData.length) {
      throw new Error('Buffer overflow');
    }

    this.xData[this.length] = x;
    this.yData[this.length] = y;
    this.length++;
  }

  get(index: number): { x: number; y: number } | undefined {
    if (index >= this.length) return undefined;

    return {
      x: this.xData[index],
      y: this.yData[index],
    };
  }

  toArray(): Array<{ x: number; y: number }> {
    const result: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < this.length; i++) {
      result.push({
        x: this.xData[i],
        y: this.yData[i],
      });
    }

    return result;
  }

  clear(): void {
    this.length = 0;
  }

  size(): number {
    return this.length;
  }

  capacity(): number {
    return this.xData.length;
  }

  memoryUsage(): number {
    // Calculate memory usage in bytes
    return this.xData.byteLength + this.yData.byteLength;
  }
}

/**
 * Usage Examples:
 *
 * // LRU Cache for processed chart data
 * const cache = useLRUCache<string, ProcessedData>(50);
 * const processedData = useMemo(() => {
 *   const cached = cache.get(chartId);
 *   if (cached) return cached;
 *
 *   const processed = processChartData(rawData);
 *   cache.set(chartId, processed);
 *   return processed;
 * }, [chartId, rawData, cache]);
 *
 * // Debounced search
 * const debouncedSearch = useDebounce((query: string) => {
 *   performSearch(query);
 * }, 300);
 *
 * // Memory pressure handling
 * useMemoryPressure((usage) => {
 *   console.warn('High memory usage:', usage);
 *   // Clear caches
 *   cache.clear();
 *   // Or trigger manual cleanup
 *   triggerGarbageCollection();
 * });
 *
 * // Efficient chart data storage
 * const buffer = new ChartDataBuffer(10000);
 * data.forEach(point => buffer.push(point.x, point.y));
 * console.log('Memory used:', buffer.memoryUsage(), 'bytes');
 */
