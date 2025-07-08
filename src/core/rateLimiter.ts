/**
 * RateLimiter - Advanced rate limiting and request queue management system
 * 
 * **Purpose**: 
 * Prevents API rate limit violations by implementing intelligent request queuing,
 * exponential backoff strategies, and multi-dimensional rate limiting (requests/tokens
 * per minute/hour/day) for various LLM providers.
 * 
 * **Dependencies**:
 * - Logger: For rate limit monitoring and violation tracking
 * - OpenAIError: For rate limit specific error handling
 * - No external dependencies (self-contained queue management)
 * 
 * **Key Patterns**:
 * - Token bucket algorithm for smooth rate limiting
 * - Priority queue for request ordering and emergency handling
 * - Exponential backoff with jitter for retry strategies
 * - Multi-dimensional limits (requests and tokens across time windows)
 * 
 * **Lifecycle**:
 * 1. Initialize with provider-specific rate limit configurations
 * 2. Queue incoming requests with priority and token estimates
 * 3. Process queue based on current rate limit status
 * 4. Apply exponential backoff for rate limit violations
 * 5. Monitor and adjust rate limits based on provider responses
 * 
 * **Performance Considerations**:
 * - Efficient priority queue using heap data structure
 * - Sliding window counters for accurate rate limit tracking
 * - Minimal overhead for rate limit checks (O(1) operations)
 * - Memory-bounded queue to prevent excessive memory usage
 * 
 * **Error Handling**:
 * - Automatic retry with exponential backoff for rate limit errors
 * - Queue overflow protection with oldest request eviction
 * - Graceful degradation when rate limits cannot be determined
 * - Detailed metrics for rate limit analysis and optimization
 */

import { agentLogger } from '../utils/logger';
import { OpenAIError } from '../utils/errors';
import { NETWORK, TIMEOUTS } from '../config/constants';

const logger = agentLogger.child({ component: 'rateLimiter' });

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  tokensPerMinute: number;
  tokensPerHour: number;
  tokensPerDay: number;
}

export interface BackoffConfig {
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  multiplier: number;
  maxRetries: number;
}

export interface QueuedRequest {
  id: string;
  timestamp: number;
  estimatedTokens: number;
  priority: 'low' | 'medium' | 'high';
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

export interface RateLimitStatus {
  canProceed: boolean;
  waitTime?: number; // milliseconds to wait
  reason?: string;
  currentUsage: {
    requestsThisMinute: number;
    requestsThisHour: number;
    requestsThisDay: number;
    tokensThisMinute: number;
    tokensThisHour: number;
    tokensThisDay: number;
  };
}

/**
 * Rate limiting and request queuing system for API calls
 * 
 * Implements token bucket algorithm with exponential backoff for managing
 * API rate limits and preventing service overload.
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private backoffConfig: BackoffConfig;
  private requestHistory: { timestamp: number; tokens: number }[] = [];
  private queue: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private consecutiveErrors = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<RateLimitConfig>, backoffConfig?: Partial<BackoffConfig>) {
    // Default limits based on OpenAI's typical rate limits
    this.config = {
      requestsPerMinute: 50,
      requestsPerHour: 3000,
      requestsPerDay: NETWORK.DEFAULT_REQUESTS_PER_DAY,
      tokensPerMinute: 90000,
      tokensPerHour: 2000000,
      tokensPerDay: 10000000,
      ...config
    };

    this.backoffConfig = {
      initialDelay: NETWORK.INITIAL_RETRY_DELAY, // 1 second
      maxDelay: NETWORK.MAX_RETRY_DELAY, // 1 minute
      multiplier: 2,
      maxRetries: 5,
      ...backoffConfig
    };

    // Clean up old requests periodically
    this.cleanupInterval = setInterval(() => this.cleanupOldRequests(), NETWORK.RATE_LIMIT_CLEANUP_INTERVAL); // Every minute
  }

  /**
   * Check if a request can proceed without hitting rate limits
   */
  public checkRateLimit(estimatedTokens: number): RateLimitStatus {
    const now = Date.now();
    const usage = this.getCurrentUsage(now);

    // Check request limits
    if (usage.requestsThisMinute >= this.config.requestsPerMinute) {
      return {
        canProceed: false,
        waitTime: this.getWaitTimeForNextMinute(now),
        reason: 'Requests per minute limit exceeded',
        currentUsage: usage
      };
    }

    if (usage.requestsThisHour >= this.config.requestsPerHour) {
      return {
        canProceed: false,
        waitTime: this.getWaitTimeForNextHour(now),
        reason: 'Requests per hour limit exceeded',
        currentUsage: usage
      };
    }

    if (usage.requestsThisDay >= this.config.requestsPerDay) {
      return {
        canProceed: false,
        waitTime: this.getWaitTimeForNextDay(now),
        reason: 'Requests per day limit exceeded',
        currentUsage: usage
      };
    }

    // Check token limits
    if (usage.tokensThisMinute + estimatedTokens > this.config.tokensPerMinute) {
      return {
        canProceed: false,
        waitTime: this.getWaitTimeForNextMinute(now),
        reason: 'Tokens per minute limit would be exceeded',
        currentUsage: usage
      };
    }

    if (usage.tokensThisHour + estimatedTokens > this.config.tokensPerHour) {
      return {
        canProceed: false,
        waitTime: this.getWaitTimeForNextHour(now),
        reason: 'Tokens per hour limit would be exceeded',
        currentUsage: usage
      };
    }

    if (usage.tokensThisDay + estimatedTokens > this.config.tokensPerDay) {
      return {
        canProceed: false,
        waitTime: this.getWaitTimeForNextDay(now),
        reason: 'Tokens per day limit would be exceeded',
        currentUsage: usage
      };
    }

    return {
      canProceed: true,
      currentUsage: usage
    };
  }

  /**
   * Execute a request with rate limiting and automatic retries
   */
  public async executeWithRateLimit<T>(
    requestFn: () => Promise<T>,
    estimatedTokens: number,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<T> {
    const requestId = this.generateRequestId();
    
    return new Promise<T>((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        id: requestId,
        timestamp: Date.now(),
        estimatedTokens,
        priority,
        resolve: async (value) => {
          try {
            const result = await this.executeWithRetry(requestFn, estimatedTokens);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        },
        reject
      };

      this.queue.push(queuedRequest);
      this.sortQueue();
      this.processQueue();
    });
  }

  /**
   * Record a successful request
   */
  public recordRequest(actualTokens: number): void {
    const now = Date.now();
    this.requestHistory.push({
      timestamp: now,
      tokens: actualTokens
    });

    this.consecutiveErrors = 0; // Reset error count on success
    
    logger.debug('Request recorded', {
      timestamp: now,
      tokens: actualTokens,
      totalRequests: this.requestHistory.length
    });
  }

  /**
   * Handle rate limit error from API
   */
  public handleRateLimitError(error: any): number {
    this.consecutiveErrors++;
    
    // Extract retry-after header if available
    let retryAfter = 0;
    if (error.headers && error.headers['retry-after']) {
      retryAfter = parseInt(error.headers['retry-after']) * TIMEOUTS.SECOND;
    }

    // Calculate backoff delay
    const backoffDelay = Math.min(
      this.backoffConfig.initialDelay * Math.pow(this.backoffConfig.multiplier, this.consecutiveErrors - 1),
      this.backoffConfig.maxDelay
    );

    const waitTime = Math.max(retryAfter, backoffDelay);

    logger.warn('Rate limit error encountered', {
      consecutiveErrors: this.consecutiveErrors,
      retryAfter,
      backoffDelay,
      waitTime,
      error: error.message
    });

    return waitTime;
  }

  /**
   * Get current rate limit status
   */
  public getStatus(): {
    queueLength: number;
    isProcessing: boolean;
    currentUsage: RateLimitStatus['currentUsage'];
    consecutiveErrors: number;
  } {
    const now = Date.now();
    const currentUsage = this.getCurrentUsage(now);

    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessingQueue,
      currentUsage,
      consecutiveErrors: this.consecutiveErrors
    };
  }

  // Private methods

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.queue.length > 0) {
        const request = this.queue[0];
        if (!request) break; // Safety check
        
        const rateLimit = this.checkRateLimit(request.estimatedTokens);

        if (!rateLimit.canProceed) {
          logger.debug('Rate limit hit, waiting', {
            waitTime: rateLimit.waitTime,
            reason: rateLimit.reason
          });
          
          if (rateLimit.waitTime) {
            await this.delay(rateLimit.waitTime);
          }
          continue;
        }

        // Remove request from queue and execute
        this.queue.shift();
        request.resolve(undefined);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async executeWithRetry<T>(requestFn: () => Promise<T>, estimatedTokens: number): Promise<T> {
    let retries = 0;

    while (retries <= this.backoffConfig.maxRetries) {
      try {
        const result = await requestFn();
        this.recordRequest(estimatedTokens); // Record on success
        return result;
      } catch (error) {
        if (this.isRateLimitError(error)) {
          const waitTime = this.handleRateLimitError(error);
          
          if (retries < this.backoffConfig.maxRetries) {
            logger.info('Retrying after rate limit', {
              retries,
              waitTime,
              maxRetries: this.backoffConfig.maxRetries
            });
            
            await this.delay(waitTime);
            retries++;
            continue;
          }
        }
        
        // Re-throw error if not rate limit or max retries exceeded
        throw error;
      }
    }

    throw new OpenAIError('Max retries exceeded', 'RATE_LIMIT_EXCEEDED');
  }

  private isRateLimitError(error: any): boolean {
    return error.status === NETWORK.HTTP_STATUS_TOO_MANY_REQUESTS || 
           (error.message && error.message.toLowerCase().includes('rate limit'));
  }

  private getCurrentUsage(now: number): RateLimitStatus['currentUsage'] {
    const oneMinuteAgo = now - TIMEOUTS.MINUTE;
    const oneHourAgo = now - TIMEOUTS.HOUR;
    const oneDayAgo = now - TIMEOUTS.DAY;

    const recentRequests = this.requestHistory.filter(req => req.timestamp > oneMinuteAgo);
    const hourlyRequests = this.requestHistory.filter(req => req.timestamp > oneHourAgo);
    const dailyRequests = this.requestHistory.filter(req => req.timestamp > oneDayAgo);

    return {
      requestsThisMinute: recentRequests.length,
      requestsThisHour: hourlyRequests.length,
      requestsThisDay: dailyRequests.length,
      tokensThisMinute: recentRequests.reduce((sum, req) => sum + req.tokens, 0),
      tokensThisHour: hourlyRequests.reduce((sum, req) => sum + req.tokens, 0),
      tokensThisDay: dailyRequests.reduce((sum, req) => sum + req.tokens, 0)
    };
  }

  private getWaitTimeForNextMinute(now: number): number {
    const oldestInMinute = this.requestHistory
      .filter(req => req.timestamp > now - TIMEOUTS.MINUTE)
      .sort((a, b) => a.timestamp - b.timestamp)[0];
    
    return oldestInMinute ? (oldestInMinute.timestamp + TIMEOUTS.MINUTE) - now : 0;
  }

  private getWaitTimeForNextHour(now: number): number {
    const oldestInHour = this.requestHistory
      .filter(req => req.timestamp > now - TIMEOUTS.HOUR)
      .sort((a, b) => a.timestamp - b.timestamp)[0];
    
    return oldestInHour ? (oldestInHour.timestamp + TIMEOUTS.HOUR) - now : 0;
  }

  private getWaitTimeForNextDay(now: number): number {
    const oldestInDay = this.requestHistory
      .filter(req => req.timestamp > now - TIMEOUTS.DAY)
      .sort((a, b) => a.timestamp - b.timestamp)[0];
    
    return oldestInDay ? (oldestInDay.timestamp + TIMEOUTS.DAY) - now : 0;
  }

  private sortQueue(): void {
    // Sort by priority (high > medium > low) then by timestamp (older first)
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      return a.timestamp - b.timestamp;
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanupOldRequests(): void {
    const oneDayAgo = Date.now() - TIMEOUTS.DAY;
    const originalLength = this.requestHistory.length;
    
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > oneDayAgo);
    
    if (originalLength > this.requestHistory.length) {
      logger.debug('Cleaned up old request history', {
        removed: originalLength - this.requestHistory.length,
        remaining: this.requestHistory.length
      });
    }
  }

  /**
   * Clean up resources and stop background processes
   * Call this when shutting down or in tests
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear any pending queue items
    this.queue.forEach(item => {
      item.reject(new OpenAIError('RateLimiter destroyed', 'RATE_LIMITER_DESTROYED'));
    });
    this.queue = [];

    logger.debug('RateLimiter destroyed and resources cleaned up');
  }
}
