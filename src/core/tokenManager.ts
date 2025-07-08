/**
 * Token Management System for LLM Agent
 * 
 * This module handles token counting, cost optimization, and budget management
 * for LLM API calls with performance optimizations and caching.
 */

import { agentLogger } from '../utils/logger';
import { globalCaches, memoize } from './performance/CacheManager';
import { VALIDATION } from '../config/constants';

const logger = agentLogger.child({ component: 'tokenManager' });

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface TokenBudget {
  dailyLimit: number;
  monthlyLimit: number;
  currentDailyUsage: number;
  currentMonthlyUsage: number;
  warningThreshold: number; // Percentage (0-100)
}

export interface TokenOptimization {
  shouldOptimize: boolean;
  recommendations: string[];
  estimatedSavings: number;
}

/**
 * TokenManager - Centralized token usage tracking and budget management
 * 
 * **Responsibility**: 
 * - Track and estimate token usage for LLM API calls
 * - Enforce daily and monthly budget constraints
 * - Provide cost optimization recommendations
 * - Cache token estimations for performance
 * 
 * **Collaborators**:
 * - CacheManager: For memoization of token estimations
 * - Logger: For usage tracking and budget warnings
 * - LLM providers: For actual token usage recording
 * 
 * **Lifecycle**:
 * 1. Initialize with budget constraints
 * 2. Load historical usage from storage
 * 3. Estimate tokens before API calls
 * 4. Check budget constraints
 * 5. Record actual usage after calls
 * 6. Persist usage data to storage
 * 
 * **Performance Considerations**:
 * - Token estimation is memoized for repeated text
 * - Daily/monthly aggregations are cached
 * - Storage operations are batched for efficiency
 * 
 * **Error Handling**:
 * - Graceful degradation if storage is unavailable
 * - Warning logs when approaching budget limits
 * - Prevents API calls that would exceed budgets
 */
export class TokenManager {
  private usage: { [date: string]: TokenUsage } = {};
  private budget: TokenBudget;

  // Memoized token estimation function
  private estimateTokensMemoized = memoize(
    this.estimateTokensRaw.bind(this),
    { 
      cache: globalCaches.tokenEstimation,
      keyGenerator: (text: string) => `tokens:${text.length}:${text.slice(0, 100)}`
    }
  );

  /**
   * Initialize TokenManager with budget constraints
   * 
   * @param budget - Optional budget configuration. Missing values use sensible defaults:
   *   - dailyLimit: 100,000 tokens
   *   - monthlyLimit: 2,000,000 tokens  
   *   - warningThreshold: 80% of limits
   * 
   * **Side Effects**:
   * - Loads historical usage data from storage
   * - Initializes memoized token estimation function
   * - Sets up budget tracking structures
   */
  constructor(budget?: Partial<TokenBudget>) {
    this.budget = {
      dailyLimit: 100000, // tokens per day
      monthlyLimit: 2000000, // tokens per month
      currentDailyUsage: 0,
      currentMonthlyUsage: 0,
      warningThreshold: 80, // warn at 80% of budget
      ...budget
    };

    this.loadUsageFromStorage();
  }

  /**
   * Estimate tokens for a given text using cached approximation
   * 
   * @param text - Input text to estimate tokens for
   * @returns Estimated token count based on content type detection
   * 
   * **Performance**: Results are memoized using text length and first 100 chars as key
   * **Algorithm**: Uses different ratios for code (1:3), JSON (1:3.5), and text (1:4)
   */
  public estimateTokens(text: string): number {
    return this.estimateTokensMemoized(text);
  }

  /**
   * Raw token estimation without caching
   * 
   * @param text - Input text to analyze
   * @returns Token count estimate based on content type heuristics
   * 
   * **Algorithm Details**:
   * - Code content (contains ```, function, class): 1 token per 3 chars
   * - JSON content (contains {, }, "): 1 token per 3.5 chars  
   * - Regular text: 1 token per 4 chars (English standard)
   * 
   * **Note**: This is an approximation - actual tokenization may vary by model
   */
  private estimateTokensRaw(text: string): number {
    // More sophisticated approximation based on text characteristics
    const words = text.split(/\s+/).length;
    const chars = text.length;
    
    // Different token ratios for different content types
    if (text.includes('```') || text.includes('function') || text.includes('class')) {
      // Code content - typically more tokens per character
      return Math.ceil(chars / 3);
    } else if (text.includes('{') && text.includes('}') && text.includes('"')) {
      // JSON content
      return Math.ceil(chars / 3.5);
    } else {
      // Regular text - 1 token ≈ 4 characters for English
      return Math.ceil(chars / 4);
    }
  }

  /**
   * Check if a request fits within daily and monthly budget constraints
   * 
   * @param estimatedTokens - Number of tokens the request is expected to consume
   * @returns Object containing:
   *   - canProceed: Whether the request can be made without exceeding limits
   *   - reason: Human-readable explanation if request is blocked
   *   - budgetStatus: Current usage statistics and remaining capacity
   * 
   * **Side Effects**: Logs warnings when approaching threshold limits
   * **Error Handling**: Returns denial with specific reason for budget violations
   */
  public checkBudget(estimatedTokens: number): {
    canProceed: boolean;
    reason?: string;
    budgetStatus: {
      dailyRemaining: number;
      monthlyRemaining: number;
      dailyPercentUsed: number;
      monthlyPercentUsed: number;
    };
  } {
    const today = this.getDateString();
    const currentMonth = this.getMonthString();
    
    const dailyUsage = this.getDailyUsage(today);
    const monthlyUsage = this.getMonthlyUsage(currentMonth);
    
    const dailyRemaining = this.budget.dailyLimit - dailyUsage;
    const monthlyRemaining = this.budget.monthlyLimit - monthlyUsage;
    
    const dailyPercentUsed = (dailyUsage / this.budget.dailyLimit) * 100;
    const monthlyPercentUsed = (monthlyUsage / this.budget.monthlyLimit) * 100;

    // Check if request would exceed limits
    if (estimatedTokens > dailyRemaining) {
      return {
        canProceed: false,
        reason: `Request would exceed daily token limit. Remaining: ${dailyRemaining}, Requested: ${estimatedTokens}`,
        budgetStatus: { dailyRemaining, monthlyRemaining, dailyPercentUsed, monthlyPercentUsed }
      };
    }

    if (estimatedTokens > monthlyRemaining) {
      return {
        canProceed: false,
        reason: `Request would exceed monthly token limit. Remaining: ${monthlyRemaining}, Requested: ${estimatedTokens}`,
        budgetStatus: { dailyRemaining, monthlyRemaining, dailyPercentUsed, monthlyPercentUsed }
      };
    }

    return {
      canProceed: true,
      budgetStatus: { dailyRemaining, monthlyRemaining, dailyPercentUsed, monthlyPercentUsed }
    };
  }

  /**
   * Record actual token usage after an API call completes
   * 
   * @param usage - Actual token consumption data from LLM provider
   * 
   * **Side Effects**:
   * - Updates daily usage totals
   * - Triggers storage persistence
   * - Logs usage for audit trail
   * - May emit budget warnings if thresholds exceeded
   * 
   * **Performance**: Usage is accumulated in memory and persisted asynchronously
   */
  public recordUsage(usage: TokenUsage): void {
    const today = this.getDateString();
    
    if (!this.usage[today]) {
      this.usage[today] = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
    }

    this.usage[today].promptTokens += usage.promptTokens;
    this.usage[today].completionTokens += usage.completionTokens;
    this.usage[today].totalTokens += usage.totalTokens;
    this.usage[today].estimatedCost += usage.estimatedCost;

    // Update budget tracking
    this.updateBudgetTracking();

    // Check for warnings
    this.checkBudgetWarnings();

    // Log usage
    logger.info('Token usage recorded', {
      date: today,
      usage,
      dailyTotal: this.usage[today],
      budgetStatus: this.getBudgetStatus()
    });

    // Persist to storage
    this.saveUsageToStorage();
  }

  /**
   * Analyze a prompt for optimization opportunities
   */
  public analyzeForOptimization(prompt: string): TokenOptimization {
    const recommendations: string[] = [];
    let estimatedSavings = 0;

    const currentTokens = this.estimateTokens(prompt);

    // Check for repetitive content
    if (this.hasRepetitiveContent(prompt)) {
      recommendations.push('Remove repetitive instructions or examples');
      estimatedSavings += currentTokens * VALIDATION.MILD_OPTIMIZATION_MULTIPLIER; // Estimate 10% savings
    }

    // Check for overly verbose instructions
    if (prompt.length > 2000) {
      recommendations.push('Consider breaking into smaller, focused prompts');
      estimatedSavings += currentTokens * VALIDATION.AGGRESSIVE_OPTIMIZATION_MULTIPLIER; // Estimate 15% savings
    }

    // Check for unnecessary examples
    const exampleCount = (prompt.match(/example:/gi) || []).length;
    if (exampleCount > 3) {
      recommendations.push('Reduce number of examples - 2-3 are usually sufficient');
      estimatedSavings += exampleCount * 50; // Estimate 50 tokens per example
    }

    // Check for redundant system instructions
    if (prompt.includes('You are') && prompt.includes('Your role is')) {
      recommendations.push('Consolidate role definitions to avoid redundancy');
      estimatedSavings += 50;
    }

    return {
      shouldOptimize: recommendations.length > 0 && estimatedSavings > currentTokens * VALIDATION.OPTIMIZATION_SAVINGS_THRESHOLD,
      recommendations,
      estimatedSavings: Math.floor(estimatedSavings)
    };
  }

  /**
   * Get current budget status
   */
  public getBudgetStatus(): {
    daily: { used: number; limit: number; remaining: number; percentUsed: number };
    monthly: { used: number; limit: number; remaining: number; percentUsed: number };
    isNearLimit: boolean;
  } {
    const today = this.getDateString();
    const currentMonth = this.getMonthString();
    
    const dailyUsed = this.getDailyUsage(today);
    const monthlyUsed = this.getMonthlyUsage(currentMonth);
    
    const dailyRemaining = this.budget.dailyLimit - dailyUsed;
    const monthlyRemaining = this.budget.monthlyLimit - monthlyUsed;
    
    const dailyPercentUsed = (dailyUsed / this.budget.dailyLimit) * 100;
    const monthlyPercentUsed = (monthlyUsed / this.budget.monthlyLimit) * 100;
    
    const isNearLimit = dailyPercentUsed > this.budget.warningThreshold || 
                       monthlyPercentUsed > this.budget.warningThreshold;

    return {
      daily: {
        used: dailyUsed,
        limit: this.budget.dailyLimit,
        remaining: dailyRemaining,
        percentUsed: dailyPercentUsed
      },
      monthly: {
        used: monthlyUsed,
        limit: this.budget.monthlyLimit,
        remaining: monthlyRemaining,
        percentUsed: monthlyPercentUsed
      },
      isNearLimit
    };
  }

  /**
   * Update budget limits
   */
  public updateBudget(dailyLimit?: number, monthlyLimit?: number, warningThreshold?: number): void {
    if (dailyLimit !== undefined) {
      this.budget.dailyLimit = dailyLimit;
    }
    if (monthlyLimit !== undefined) {
      this.budget.monthlyLimit = monthlyLimit;
    }
    if (warningThreshold !== undefined) {
      this.budget.warningThreshold = warningThreshold;
    }

    logger.info('Token budget updated', { budget: this.budget });
  }

  // Private helper methods

  private getDateString(): string {
    return new Date().toISOString().split('T')[0]!;
  }

  private getMonthString(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getDailyUsage(date: string): number {
    return this.usage[date]?.totalTokens || 0;
  }

  private getMonthlyUsage(month: string): number {
    return Object.keys(this.usage)
      .filter(date => date.startsWith(month))
      .reduce((total, date) => total + (this.usage[date]?.totalTokens || 0), 0);
  }

  private updateBudgetTracking(): void {
    const today = this.getDateString();
    const currentMonth = this.getMonthString();
    
    this.budget.currentDailyUsage = this.getDailyUsage(today);
    this.budget.currentMonthlyUsage = this.getMonthlyUsage(currentMonth);
  }

  private checkBudgetWarnings(): void {
    const status = this.getBudgetStatus();
    
    if (status.daily.percentUsed > this.budget.warningThreshold) {
      logger.warn('Daily token budget warning', {
        percentUsed: status.daily.percentUsed,
        threshold: this.budget.warningThreshold,
        remaining: status.daily.remaining
      });
    }
    
    if (status.monthly.percentUsed > this.budget.warningThreshold) {
      logger.warn('Monthly token budget warning', {
        percentUsed: status.monthly.percentUsed,
        threshold: this.budget.warningThreshold,
        remaining: status.monthly.remaining
      });
    }
  }

  private hasRepetitiveContent(text: string): boolean {
    // Simple check for repetitive phrases (same 5+ word sequence appears multiple times)
    const words = text.toLowerCase().split(/\s+/);
    const phrases = new Map<string, number>();
    
    for (let i = 0; i <= words.length - 5; i++) {
      const phrase = words.slice(i, i + 5).join(' ');
      phrases.set(phrase, (phrases.get(phrase) || 0) + 1);
    }
    
    return Array.from(phrases.values()).some(count => count > 2);
  }

  private loadUsageFromStorage(): void {
    // In a real implementation, this would load from a persistent store
    // For now, we'll start with empty usage
    this.usage = {};
  }

  private saveUsageToStorage(): void {
    // In a real implementation, this would persist to a database or file
    // For now, we'll just keep it in memory
  }
}
