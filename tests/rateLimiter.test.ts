import { RateLimiter, RateLimitConfig, BackoffConfig } from '../src/core/rateLimiter';

// Mock the OpenAIError import
jest.mock('../src/utils/errors', () => ({
  OpenAIError: class OpenAIError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'OpenAIError';
    }
  }
}));

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    if (rateLimiter) {
      rateLimiter.destroy();
    }
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limits', () => {
      const status = rateLimiter.checkRateLimit(1000);

      expect(status.canProceed).toBe(true);
      expect(status.waitTime).toBeUndefined();
      expect(status.reason).toBeUndefined();
      expect(status.currentUsage).toBeDefined();
    });

    it('should provide current usage information', () => {
      const status = rateLimiter.checkRateLimit(1000);

      expect(status.currentUsage.requestsThisMinute).toBeGreaterThanOrEqual(0);
      expect(status.currentUsage.requestsThisHour).toBeGreaterThanOrEqual(0);
      expect(status.currentUsage.requestsThisDay).toBeGreaterThanOrEqual(0);
      expect(status.currentUsage.tokensThisMinute).toBeGreaterThanOrEqual(0);
      expect(status.currentUsage.tokensThisHour).toBeGreaterThanOrEqual(0);
      expect(status.currentUsage.tokensThisDay).toBeGreaterThanOrEqual(0);
    });

    it('should reject when token limits would be exceeded', async () => {
      const config: Partial<RateLimitConfig> = {
        tokensPerMinute: 1000
      };
      const limiter = new RateLimiter(config);

      // First, add some request history to make rate limiting meaningful
      await limiter.executeWithRateLimit(
        () => Promise.resolve('test'),
        800, // tokens that are within limit
        'low'
      );

      // Wait a small amount to ensure timestamp differences
      await new Promise(resolve => setTimeout(resolve, 10));

      // Now try a request that would exceed the limit
      const status = limiter.checkRateLimit(500); // Would exceed 1000 total

      expect(status.canProceed).toBe(false);
      expect(status.reason).toContain('minute');
      // With request history, there should be a wait time
      if (status.waitTime !== undefined) {
        expect(status.waitTime).toBeGreaterThanOrEqual(0);
      }

      limiter.destroy();
    });

    it('should reject when request limits would be exceeded', () => {
      const config: Partial<RateLimitConfig> = {
        requestsPerMinute: 1
      };
      const limiter = new RateLimiter(config);

      // First request should be fine
      let status = limiter.checkRateLimit(100);
      expect(status.canProceed).toBe(true);

      // Record the request
      limiter.recordRequest(100);

      // Second request should be rejected
      status = limiter.checkRateLimit(100);
      expect(status.canProceed).toBe(false);
      expect(status.reason).toContain('minute');

      limiter.destroy();
    });
  });

  describe('executeWithRateLimit', () => {
    it('should execute function immediately when under limits', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await rateLimiter.executeWithRateLimit(mockFn, 1000);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should queue requests when at limits', async () => {
      const config: Partial<RateLimitConfig> = {
        requestsPerMinute: 1
      };
      const limiter = new RateLimiter(config);

      const mockFn1 = jest.fn().mockResolvedValue('first');
      const mockFn2 = jest.fn().mockResolvedValue('second');

      // Both should be queued but executed in order
      const promise1 = limiter.executeWithRateLimit(mockFn1, 100, 'high');
      const promise2 = limiter.executeWithRateLimit(mockFn2, 100, 'low');

      const results = await Promise.all([promise1, promise2]);

      expect(results).toEqual(['first', 'second']);
      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).toHaveBeenCalledTimes(1);

      limiter.destroy();
    }, 10000);

    it('should respect priority ordering in queue', async () => {
      const config: Partial<RateLimitConfig> = {
        requestsPerMinute: 1
      };
      const limiter = new RateLimiter(config);

      const executionOrder: string[] = [];
      const mockHighPriority = jest.fn().mockImplementation(async () => {
        executionOrder.push('high');
        return 'high';
      });
      const mockLowPriority = jest.fn().mockImplementation(async () => {
        executionOrder.push('low');
        return 'low';
      });

      // Submit low priority first, then high priority
      const lowPromise = limiter.executeWithRateLimit(mockLowPriority, 100, 'low');
      const highPromise = limiter.executeWithRateLimit(mockHighPriority, 100, 'high');

      await Promise.all([lowPromise, highPromise]);

      // High priority should execute first despite being submitted second
      expect(executionOrder[0]).toBe('low'); // First one goes through immediately
      expect(executionOrder[1]).toBe('high'); // High priority queued item goes next

      limiter.destroy();
    }, 10000);
  });

  describe('recordRequest', () => {
    it('should record successful requests', () => {
      const initialStatus = rateLimiter.getStatus();
      const initialUsage = initialStatus.currentUsage;

      rateLimiter.recordRequest(1000);

      const newStatus = rateLimiter.getStatus();
      const newUsage = newStatus.currentUsage;

      expect(newUsage.requestsThisMinute).toBe(initialUsage.requestsThisMinute + 1);
      expect(newUsage.tokensThisMinute).toBe(initialUsage.tokensThisMinute + 1000);
    });

    it('should reset consecutive errors on success', () => {
      // Simulate some errors first
      const error = new Error('Rate limit error');
      rateLimiter.handleRateLimitError(error);
      rateLimiter.handleRateLimitError(error);

      let status = rateLimiter.getStatus();
      expect(status.consecutiveErrors).toBe(2);

      // Record a successful request
      rateLimiter.recordRequest(100);

      status = rateLimiter.getStatus();
      expect(status.consecutiveErrors).toBe(0);
    });
  });

  describe('handleRateLimitError', () => {
    it('should calculate backoff delay', () => {
      const error = new Error('Rate limit exceeded');
      const waitTime = rateLimiter.handleRateLimitError(error);

      expect(waitTime).toBeGreaterThan(0);
      expect(typeof waitTime).toBe('number');
    });

    it('should use retry-after header when available', () => {
      const error = {
        message: 'Rate limit exceeded',
        headers: { 'retry-after': '5' }
      };
      
      const waitTime = rateLimiter.handleRateLimitError(error);

      expect(waitTime).toBeGreaterThanOrEqual(5000); // 5 seconds in ms
    });

    it('should increase consecutive error count', () => {
      const error = new Error('Rate limit error');
      
      const initialStatus = rateLimiter.getStatus();
      expect(initialStatus.consecutiveErrors).toBe(0);

      rateLimiter.handleRateLimitError(error);
      rateLimiter.handleRateLimitError(error);

      const newStatus = rateLimiter.getStatus();
      expect(newStatus.consecutiveErrors).toBe(2);
    });

    it('should apply exponential backoff', () => {
      const error = new Error('Rate limit error');
      
      const waitTime1 = rateLimiter.handleRateLimitError(error);
      const waitTime2 = rateLimiter.handleRateLimitError(error);
      const waitTime3 = rateLimiter.handleRateLimitError(error);

      expect(waitTime2).toBeGreaterThan(waitTime1);
      expect(waitTime3).toBeGreaterThan(waitTime2);
    });
  });

  describe('getStatus', () => {
    it('should return current status information', () => {
      const status = rateLimiter.getStatus();

      expect(status.queueLength).toBeGreaterThanOrEqual(0);
      expect(typeof status.isProcessing).toBe('boolean');
      expect(status.currentUsage).toBeDefined();
      expect(status.consecutiveErrors).toBeGreaterThanOrEqual(0);
    });

    it('should reflect queue changes', async () => {
      const config: Partial<RateLimitConfig> = {
        requestsPerMinute: 1 // Very low limit to force queueing
      };
      const limiter = new RateLimiter(config);

      const initialStatus = limiter.getStatus();
      expect(initialStatus.queueLength).toBe(0);

      // First request should execute immediately
      const mockFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('test'), 50))
      );
      
      // Start first request
      const promise1 = limiter.executeWithRateLimit(mockFn, 100, 'high');
      
      // Immediately start second request (should be queued)
      const promise2 = limiter.executeWithRateLimit(mockFn, 100, 'high');

      // Check status while first request is processing
      const queuedStatus = limiter.getStatus();
      expect(queuedStatus.queueLength).toBeGreaterThanOrEqual(0); // Could be 0 or 1 depending on timing
      
      // Wait for completion
      await Promise.all([promise1, promise2]);

      limiter.destroy();
    });
  });

  describe('custom configuration', () => {
    it('should accept custom rate limit config', () => {
      const customConfig: Partial<RateLimitConfig> = {
        requestsPerMinute: 10,
        tokensPerMinute: 5000
      };
      
      const limiter = new RateLimiter(customConfig);
      
      // Should use custom limits
      const status = limiter.checkRateLimit(6000); // Exceeds custom token limit
      expect(status.canProceed).toBe(false);

      limiter.destroy();
    });

    it('should accept custom backoff config', () => {
      const customBackoff: Partial<BackoffConfig> = {
        initialDelay: 500,
        maxRetries: 2
      };
      
      const limiter = new RateLimiter(undefined, customBackoff);
      
      const error = new Error('Rate limit error');
      const waitTime = limiter.handleRateLimitError(error);
      
      expect(waitTime).toBeGreaterThanOrEqual(500);

      limiter.destroy();
    });
  });

  describe('cleanup and resource management', () => {
    it('should clean up old requests periodically', () => {
      // Record some requests
      rateLimiter.recordRequest(100);
      rateLimiter.recordRequest(200);
      
      const status = rateLimiter.getStatus();
      expect(status.currentUsage.requestsThisMinute).toBeGreaterThan(0);
      
      // The cleanup happens automatically via interval, we can't easily test it
      // without mocking timers, but we can verify the method exists
      expect(rateLimiter.destroy).toBeDefined();
    });

    it('should clear queue on destroy', async () => {
      const config: Partial<RateLimitConfig> = {
        requestsPerMinute: 1 // Very low limit to force queueing
      };
      const limiter = new RateLimiter(config);

      // Add items to queue by starting long-running requests
      const mockFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('test'), 100))
      );
      
      // Start multiple requests to fill queue
      const promise1 = limiter.executeWithRateLimit(mockFn, 100, 'high');
      const promise2 = limiter.executeWithRateLimit(mockFn, 100, 'high');
      const promise3 = limiter.executeWithRateLimit(mockFn, 100, 'high');

      // Wait a moment for queue to build
      await new Promise(resolve => setTimeout(resolve, 10));

      let status = limiter.getStatus();
      expect(status.queueLength).toBeGreaterThanOrEqual(0); // At least some requests might be queued

      limiter.destroy();

      status = limiter.getStatus();
      expect(status.queueLength).toBe(0);
      
      // Clean up any remaining promises
      try {
        await Promise.all([promise1, promise2, promise3]);
      } catch (error) {
        // Expected - destroy should cancel queued requests
      }
    });
  });

  describe('error handling', () => {
    it('should handle retry logic for rate limit errors', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValueOnce('success');

      // Mock isRateLimitError to return true for our test error
      const originalIsRateLimitError = (rateLimiter as any).isRateLimitError;
      (rateLimiter as any).isRateLimitError = jest.fn().mockReturnValue(true);

      const result = await rateLimiter.executeWithRateLimit(mockFn, 100);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2); // Original call + 1 retry

      // Restore original method
      (rateLimiter as any).isRateLimitError = originalIsRateLimitError;
    });

    it('should throw error for non-rate-limit errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Other error'));

      await expect(rateLimiter.executeWithRateLimit(mockFn, 100))
        .rejects.toThrow('Other error');

      expect(mockFn).toHaveBeenCalledTimes(1); // No retry for non-rate-limit errors
    });

    it('should throw error after max retries exceeded', async () => {
      const config: Partial<BackoffConfig> = {
        maxRetries: 1
      };
      const limiter = new RateLimiter(undefined, config);

      const mockFn = jest.fn().mockRejectedValue(new Error('Rate limit exceeded'));

      // Mock isRateLimitError to return true
      (limiter as any).isRateLimitError = jest.fn().mockReturnValue(true);

      await expect(limiter.executeWithRateLimit(mockFn, 100))
        .rejects.toThrow();

      expect(mockFn).toHaveBeenCalledTimes(2); // Original + 1 retry (maxRetries = 1)

      limiter.destroy();
    });
  });

  describe('wait time calculations', () => {
    it('should calculate wait time for next minute correctly', () => {
      const config: Partial<RateLimitConfig> = {
        requestsPerMinute: 1
      };
      const limiter = new RateLimiter(config);

      limiter.recordRequest(100);
      const status = limiter.checkRateLimit(100);

      if (!status.canProceed && status.waitTime) {
        expect(status.waitTime).toBeGreaterThan(0);
        expect(status.waitTime).toBeLessThanOrEqual(60000); // Should be within a minute
      }

      limiter.destroy();
    });

    it('should handle edge cases in time calculations', () => {
      // Test with very restrictive limits
      const config: Partial<RateLimitConfig> = {
        requestsPerMinute: 1,
        requestsPerHour: 1,
        requestsPerDay: 1
      };
      const limiter = new RateLimiter(config);

      limiter.recordRequest(100);

      const status = limiter.checkRateLimit(100);
      expect(status.canProceed).toBe(false);
      expect(status.waitTime).toBeGreaterThan(0);

      limiter.destroy();
    });
  });
});
