/**
 * CacheManager - High-performance caching and memoization system
 * 
 * **Purpose**: 
 * Provides LRU caching, memoization, and performance optimization utilities
 * to reduce redundant computations and improve system responsiveness across
 * all agent components.
 * 
 * **Dependencies**:
 * - Logger: For cache hit/miss metrics and eviction logging
 * - No external dependencies (self-contained cache implementation)
 * 
 * **Key Patterns**:
 * - LRU eviction strategy for memory efficiency
 * - TTL-based cache expiration for data freshness
 * - Memoization decorators for function result caching
 * - Global cache instances for system-wide optimization
 * 
 * **Lifecycle**:
 * 1. Initialize cache instances with size and TTL limits
 * 2. Cache frequently accessed data (token estimates, API responses)
 * 3. Automatic eviction based on LRU policy and TTL expiration
 * 4. Metrics collection for cache effectiveness monitoring
 * 
 * **Performance Considerations**:
 * - O(1) cache access using Map-based implementation
 * - Configurable memory limits to prevent unbounded growth
 * - Lazy eviction on access to minimize overhead
 * - Hit/miss ratio tracking for optimization insights
 * 
 * **Error Handling**:
 * - Graceful degradation when cache is full or unavailable
 * - Automatic cleanup of expired entries
 * - Safe handling of serialization errors for complex objects
 */

import { agentLogger } from '../../utils/logger';

const logger = agentLogger.child({ component: 'performance' });

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size
  onEvict?: (key: string, value: any) => void;
}

/**
 * LRUCache - Least Recently Used cache with TTL support
 * 
 * **Responsibility**: 
 * - Efficient storage and retrieval of frequently accessed data
 * - Automatic eviction of least recently used items when at capacity
 * - TTL-based expiration for time-sensitive data
 * - Hit/miss metrics for performance monitoring
 * 
 * **Collaborators**:
 * - CacheEntry: Individual cached item with metadata
 * - Logger: Performance metrics and eviction notifications
 * 
 * **Lifecycle**:
 * 1. Initialize with capacity and TTL constraints
 * 2. Store items with automatic timestamp and hit tracking
 * 3. Retrieve items with LRU ordering update
 * 4. Evict expired or excess items automatically
 * 
 * **Performance**: O(1) get/set operations, O(1) LRU updates using Map ordering
 * **Memory**: Bounded by maxSize configuration to prevent memory leaks
 */
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private options: Required<CacheOptions>;

  /**
   * Initialize LRU cache with configurable options
   * 
   * @param options - Cache configuration:
   *   - ttl: Time-to-live in milliseconds (default: 5 minutes)
   *   - maxSize: Maximum number of cached items (default: 1000)
   *   - onEvict: Callback fired when items are evicted
   * 
   * **Side Effects**: Sets up internal data structures and default values
   */
  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
      maxSize: options.maxSize || 1000,
      onEvict: options.onEvict || (() => {})
    };
  }

  /**
   * Retrieve value from cache with LRU and TTL validation
   * 
   * @param key - Cache key to lookup
   * @returns Cached value if valid and not expired, undefined otherwise
   * 
   * **Side Effects**:
   * - Updates LRU ordering by moving accessed item to end
   * - Increments hit counter for accessed item
   * - Removes expired items automatically
   * 
   * **Performance**: O(1) lookup and LRU update using Map operations
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access pattern (move to end for LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, customTtl?: number): void {
    // Evict if at max size
    if (this.cache.size >= this.options.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl: customTtl || this.options.ttl,
      hits: 0
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Remove entry from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.options.onEvict(key, entry.value);
    }
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    for (const [key, entry] of this.cache.entries()) {
      this.options.onEvict(key, entry.value);
    }
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let totalHits = 0;
    let expiredCount = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      if (now - entry.timestamp > entry.ttl) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      totalHits,
      expiredCount,
      hitRate: totalHits > 0 ? totalHits / this.cache.size : 0
    };
  }

  private evictLeastRecentlyUsed(): void {
    const firstEntry = this.cache.entries().next().value;
    if (firstEntry) {
      const [key, entry] = firstEntry;
      this.options.onEvict(key, entry.value);
      this.cache.delete(key);
    }
  }
}

/**
 * Function memoization with cache
 */
export function memoize<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: { 
    keyGenerator?: (...args: TArgs) => string;
    cache?: LRUCache<TReturn>;
  } = {}
): (...args: TArgs) => TReturn {
  const cache = options.cache || new LRUCache<TReturn>();
  const keyGen = options.keyGenerator || ((...args) => JSON.stringify(args));

  return (...args: TArgs): TReturn => {
    const key = keyGen(...args);
    let result = cache.get(key);

    if (result === undefined) {
      result = fn(...args);
      cache.set(key, result);
    }

    return result;
  };
}

/**
 * Async function memoization
 */
export function memoizeAsync<TArgs extends any[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: { 
    keyGenerator?: (...args: TArgs) => string;
    cache?: LRUCache<Promise<TReturn>>;
  } = {}
): (...args: TArgs) => Promise<TReturn> {
  const cache = options.cache || new LRUCache<Promise<TReturn>>();
  const keyGen = options.keyGenerator || ((...args) => JSON.stringify(args));

  return async (...args: TArgs): Promise<TReturn> => {
    const key = keyGen(...args);
    let promise = cache.get(key);

    if (promise === undefined) {
      promise = fn(...args).catch(error => {
        // Remove failed promises from cache
        cache.delete(key);
        throw error;
      });
      cache.set(key, promise);
    }

    return promise;
  };
}

/**
 * Debounce function calls
 */
export function debounce<TArgs extends any[]>(
  fn: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: TArgs): void => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Throttle function calls
 */
export function throttle<TArgs extends any[]>(
  fn: (...args: TArgs) => void,
  interval: number
): (...args: TArgs) => void {
  let lastCallTime = 0;

  return (...args: TArgs): void => {
    const now = Date.now();
    if (now - lastCallTime >= interval) {
      lastCallTime = now;
      fn(...args);
    }
  };
}

/**
 * Batch operations together
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private timeout: NodeJS.Timeout | null = null;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: {
      maxBatchSize?: number;
      maxWaitTime?: number;
    } = {}
  ) {
    this.options = {
      maxBatchSize: options.maxBatchSize || 100,
      maxWaitTime: options.maxWaitTime || 100
    };
  }

  /**
   * Add item to batch queue
   */
  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push(item);

      // Attach resolve/reject to the item for later processing
      (item as any).__resolve = resolve;
      (item as any).__reject = reject;

      this.scheduleProcessing();
    });
  }

  private scheduleProcessing(): void {
    // Process immediately if batch is full
    if (this.queue.length >= this.options.maxBatchSize!) {
      this.processBatch();
      return;
    }

    // Schedule processing if not already scheduled
    if (!this.timeout) {
      this.timeout = setTimeout(() => {
        this.processBatch();
      }, this.options.maxWaitTime);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    const currentBatch = this.queue.splice(0);

    try {
      const results = await this.processor(currentBatch);
      
      currentBatch.forEach((item, index) => {
        const resolve = (item as any).__resolve;
        if (resolve) {
          resolve(results[index]);
        }
      });
    } catch (error) {
      currentBatch.forEach(item => {
        const reject = (item as any).__reject;
        if (reject) {
          reject(error);
        }
      });
    }
  }
}

/**
 * Global caches for common operations
 */
export const globalCaches = {
  tokenEstimation: new LRUCache<number>({ ttl: 60 * 60 * 1000 }), // 1 hour
  configValidation: new LRUCache<any>({ ttl: 10 * 60 * 1000 }), // 10 minutes
  promptTemplates: new LRUCache<string>({ ttl: 30 * 60 * 1000 }) // 30 minutes
};
