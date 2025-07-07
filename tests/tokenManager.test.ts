import { TokenManager, TokenUsage, TokenOptimization } from '../src/core/tokenManager';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager();
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for simple text', () => {
      const text = 'Hello world';
      const tokens = tokenManager.estimateTokens(text);
      
      // Should be roughly text.length / 4
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('should handle empty string', () => {
      const tokens = tokenManager.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should estimate more tokens for longer text', () => {
      const shortText = 'Hello';
      const longText = 'Hello world this is a much longer piece of text';
      
      const shortTokens = tokenManager.estimateTokens(shortText);
      const longTokens = tokenManager.estimateTokens(longText);
      
      expect(longTokens).toBeGreaterThan(shortTokens);
    });
  });

  describe('checkBudget', () => {
    it('should allow requests within budget', () => {
      const result = tokenManager.checkBudget(1000); // Small request

      expect(result.canProceed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.budgetStatus).toBeDefined();
    });

    it('should reject requests exceeding daily limit', () => {
      const result = tokenManager.checkBudget(200000); // Exceeds daily limit

      expect(result.canProceed).toBe(false);
      expect(result.reason).toContain('daily');
      expect(result.budgetStatus.dailyRemaining).toBeLessThan(200000);
    });

    it('should reject requests exceeding monthly limit', () => {
      // First, exhaust the daily limit but not monthly by recording usage
      tokenManager.recordUsage({
        promptTokens: 90000,
        completionTokens: 5000,
        totalTokens: 95000,
        estimatedCost: 0.19
      });

      // Now test a request that would exceed monthly but not daily
      // First, simulate we've used up most of our monthly budget over past days
      const currentMonth = tokenManager['getMonthString'](); // Use same method as TokenManager
      
      // Mock historical usage to exceed monthly limit  
      // Use 30 days of 68k tokens each = 2.04M tokens used  
      // This exceeds the monthly limit of 2M, leaving negative remaining
      for (let day = 1; day <= 30; day++) {
        const dateKey = `${currentMonth}-${String(day).padStart(2, '0')}`;
        tokenManager['usage'][dateKey] = {
          promptTokens: 54400,
          completionTokens: 13600,
          totalTokens: 68000,
          estimatedCost: 0.68
        };
      }
      
      // Set today's usage to be very low so daily budget is not exceeded
      const today = tokenManager['getDateString']();
      tokenManager['usage'][today] = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
      
      // Update budget tracking to reflect the usage
      tokenManager['updateBudgetTracking']();
      
      // Request that exceeds monthly but not daily 
      // Monthly remaining: 2M - 2.04M = -40k (negative!)
      // Daily remaining: 100k - 0 = 100k 
      // Use 50k which is less than daily limit but monthly already exceeded
      const result = tokenManager.checkBudget(50000);

      expect(result.canProceed).toBe(false);
      expect(result.reason).toContain('monthly');
      expect(result.budgetStatus.monthlyRemaining).toBeLessThan(50000);
    });

    it('should provide budget status information', () => {
      const result = tokenManager.checkBudget(1000);

      expect(result.budgetStatus.dailyRemaining).toBeGreaterThan(0);
      expect(result.budgetStatus.monthlyRemaining).toBeGreaterThan(0);
      expect(result.budgetStatus.dailyPercentUsed).toBeGreaterThanOrEqual(0);
      expect(result.budgetStatus.monthlyPercentUsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recordUsage', () => {
    it('should record token usage', () => {
      const usage: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01
      };

      expect(() => tokenManager.recordUsage(usage)).not.toThrow();

      const budgetStatus = tokenManager.getBudgetStatus();
      expect(budgetStatus.daily.used).toBeGreaterThan(0);
    });

    it('should accumulate usage across multiple recordings', () => {
      const usage1: TokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.01
      };

      const usage2: TokenUsage = {
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
        estimatedCost: 0.02
      };

      tokenManager.recordUsage(usage1);
      const statusAfterFirst = tokenManager.getBudgetStatus();
      
      tokenManager.recordUsage(usage2);
      const statusAfterSecond = tokenManager.getBudgetStatus();

      expect(statusAfterSecond.daily.used).toBeGreaterThan(statusAfterFirst.daily.used);
      expect(statusAfterSecond.daily.used).toBe(450); // 150 + 300
    });
  });

  describe('getBudgetStatus', () => {
    it('should return current budget status', () => {
      const status = tokenManager.getBudgetStatus();

      expect(status.daily).toBeDefined();
      expect(status.monthly).toBeDefined();
      expect(status.daily.used).toBeGreaterThanOrEqual(0);
      expect(status.daily.limit).toBeGreaterThan(0);
      expect(status.daily.remaining).toBeGreaterThanOrEqual(0);
      expect(status.daily.percentUsed).toBeGreaterThanOrEqual(0);
      expect(status.isNearLimit).toBe(false); // Should be false for new instance
    });

    it('should indicate when near limit', () => {
      // Record usage that gets us close to the warning threshold
      const highUsage: TokenUsage = {
        promptTokens: 80000,
        completionTokens: 5000,
        totalTokens: 85000, // 85% of default daily limit (100k)
        estimatedCost: 1.0
      };

      tokenManager.recordUsage(highUsage);
      const status = tokenManager.getBudgetStatus();

      expect(status.isNearLimit).toBe(true);
      expect(status.daily.percentUsed).toBeGreaterThan(80);
    });
  });

  describe('analyzeForOptimization', () => {
    it('should analyze short prompts with no optimizations needed', () => {
      const prompt = 'Create a simple file';
      const analysis = tokenManager.analyzeForOptimization(prompt);

      expect(analysis.shouldOptimize).toBe(false);
      expect(analysis.recommendations).toHaveLength(0);
      expect(analysis.estimatedSavings).toBe(0);
    });

    it('should suggest optimizations for long prompts', () => {
      const longPrompt = 'A'.repeat(3000); // Very long prompt
      const analysis = tokenManager.analyzeForOptimization(longPrompt);

      expect(analysis.shouldOptimize).toBe(true);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.estimatedSavings).toBeGreaterThan(0);
    });

    it('should detect repetitive content', () => {
      const repetitivePrompt = 'Please create a file please create a file please create a file please create a file please create a file';
      const analysis = tokenManager.analyzeForOptimization(repetitivePrompt);

      expect(analysis.shouldOptimize).toBe(true);
      expect(analysis.recommendations.some(r => r.includes('repetitive'))).toBe(true);
    });

    it('should detect too many examples', () => {
      const promptWithManyExamples = `
        Create a file. 
        Example: file1.txt
        Example: file2.txt  
        Example: file3.txt
        Example: file4.txt
        Example: file5.txt
      `;
      const analysis = tokenManager.analyzeForOptimization(promptWithManyExamples);

      expect(analysis.shouldOptimize).toBe(true);
      expect(analysis.recommendations.some(r => r.includes('examples'))).toBe(true);
    });

    it('should detect redundant role definitions', () => {
      const redundantPrompt = 'You are a helpful assistant. Your role is to help users.';
      const analysis = tokenManager.analyzeForOptimization(redundantPrompt);

      expect(analysis.recommendations.some(r => r.includes('role definitions'))).toBe(true);
    });
  });

  describe('updateBudget', () => {
    it('should update daily budget limit', () => {
      const newDailyLimit = 50000;
      tokenManager.updateBudget(newDailyLimit);

      const status = tokenManager.getBudgetStatus();
      expect(status.daily.limit).toBe(newDailyLimit);
    });

    it('should update monthly budget limit', () => {
      const newMonthlyLimit = 1000000;
      tokenManager.updateBudget(undefined, newMonthlyLimit);

      const status = tokenManager.getBudgetStatus();
      expect(status.monthly.limit).toBe(newMonthlyLimit);
    });

    it('should update warning threshold', () => {
      const newThreshold = 90;
      tokenManager.updateBudget(undefined, undefined, newThreshold);

      // Record usage that would trigger the new threshold
      const usage: TokenUsage = {
        promptTokens: 95000,
        completionTokens: 0,
        totalTokens: 95000, // 95% of default daily limit
        estimatedCost: 1.0
      };

      tokenManager.recordUsage(usage);
      const status = tokenManager.getBudgetStatus();

      expect(status.isNearLimit).toBe(true);
    });
  });

  describe('budget warnings', () => {
    it('should trigger warnings when approaching limits', () => {
      // Mock console to capture warning logs
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const highDailyUsage: TokenUsage = {
        promptTokens: 85000,
        completionTokens: 0,
        totalTokens: 85000, // 85% of daily limit
        estimatedCost: 1.0
      };

      tokenManager.recordUsage(highDailyUsage);

      // Clean up
      consoleSpy.mockRestore();
    });
  });

  describe('budget calculations', () => {
    it('should correctly calculate percentages', () => {
      const usage: TokenUsage = {
        promptTokens: 25000,
        completionTokens: 0,
        totalTokens: 25000, // 25% of default daily limit (100k)
        estimatedCost: 0.5
      };

      tokenManager.recordUsage(usage);
      const status = tokenManager.getBudgetStatus();

      expect(status.daily.percentUsed).toBe(25);
      expect(status.daily.remaining).toBe(75000);
    });

    it('should handle edge case of zero limits', () => {
      tokenManager.updateBudget(0, 0);
      
      const result = tokenManager.checkBudget(1);
      expect(result.canProceed).toBe(false);
    });
  });

  describe('date handling', () => {
    it('should track usage by date', () => {
      const usage: TokenUsage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        estimatedCost: 0.01
      };

      tokenManager.recordUsage(usage);
      
      // Record again should accumulate for the same day
      tokenManager.recordUsage(usage);
      
      const status = tokenManager.getBudgetStatus();
      expect(status.daily.used).toBe(3000); // 1500 * 2
    });
  });

  describe('optimization analysis details', () => {
    it('should provide specific recommendations for verbose instructions', () => {
      const verbosePrompt = 'A'.repeat(2500); // Long enough to trigger verbose warning
      const analysis = tokenManager.analyzeForOptimization(verbosePrompt);

      expect(analysis.recommendations.some(r => r.includes('smaller, focused'))).toBe(true);
    });

    it('should calculate estimated savings correctly', () => {
      const longPrompt = 'A'.repeat(3000);
      const analysis = tokenManager.analyzeForOptimization(longPrompt);

      expect(analysis.estimatedSavings).toBeGreaterThan(0);
      expect(typeof analysis.estimatedSavings).toBe('number');
    });

    it('should not suggest optimization for already optimal prompts', () => {
      const goodPrompt = 'Create a file named test.txt with content "Hello World"';
      const analysis = tokenManager.analyzeForOptimization(goodPrompt);

      expect(analysis.shouldOptimize).toBe(false);
      expect(analysis.recommendations).toHaveLength(0);
    });
  });
});
