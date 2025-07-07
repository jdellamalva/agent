/**
 * LLM Orchestrator
 * 
 * This class handles the high-level orchestration of LLM interactions,
 * coordinating between prompt engineering, response parsing, token management,
 * and rate limiting in a provider-agnostic way.
 */

import { agentLogger } from '../../utils/logger';
import { LLMProvider, LLMRequest, LLMResponse, LLMTokenUsage } from './LLMProvider';
import { PromptEngineer, SystemPromptContext, ParsedResponse } from '../promptEngineer';
import { ResponseParser } from '../responseParser';
import { TokenManager, TokenUsage as ManagerTokenUsage } from '../tokenManager';
import { RateLimiter } from '../rateLimiter';

const logger = agentLogger.child({ component: 'llm-orchestrator' });

export interface OrchestrationRequest {
  userRequest: string;
  context?: {
    projectContext?: string;
    conversationHistory?: string[];
  };
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

export interface OrchestrationResponse {
  response: ParsedResponse;
  validation: ReturnType<ResponseParser['parseAndValidateResponse']>;
  tokenUsage: ManagerTokenUsage;
  budgetStatus: ReturnType<TokenManager['getBudgetStatus']>;
  providerUsed: string;
}

export interface OrchestrationSystemStatus {
  provider: {
    name: string;
    isHealthy: boolean;
    capabilities: ReturnType<LLMProvider['getCapabilities']>;
  };
  rateLimiter: ReturnType<RateLimiter['getStatus']>;
  tokenManager: ReturnType<TokenManager['getBudgetStatus']>;
  isHealthy: boolean;
}

export class LLMOrchestrator {
  private provider: LLMProvider;
  private promptEngineer: PromptEngineer;
  private responseParser: ResponseParser;
  private tokenManager: TokenManager;
  private rateLimiter: RateLimiter;

  constructor(provider: LLMProvider) {
    this.provider = provider;
    this.promptEngineer = new PromptEngineer();
    this.responseParser = new ResponseParser();
    this.tokenManager = new TokenManager();
    this.rateLimiter = new RateLimiter();

    logger.info('LLM Orchestrator initialized', {
      provider: this.provider.getProviderName(),
      capabilities: this.provider.getCapabilities()
    });
  }

  /**
   * Process a structured request using the full Think-Act-Observe cycle
   */
  async processStructuredRequest(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    try {
      // Step 1: Generate optimized system prompt
      const promptContext: SystemPromptContext = {
        userRequest: request.userRequest,
        ...request.context
      };

      const systemPrompt = this.promptEngineer.generateSystemPrompt(promptContext);

      // Step 2: Check token budget and optimize if needed
      const estimatedTokens = this.provider.estimateTokens(systemPrompt + request.userRequest);
      const budgetCheck = this.tokenManager.checkBudget(estimatedTokens);

      if (!budgetCheck.canProceed) {
        throw new Error(budgetCheck.reason || 'Token budget exceeded');
      }

      // Step 3: Optimize prompt if beneficial
      const optimization = this.tokenManager.analyzeForOptimization(systemPrompt);
      if (optimization.shouldOptimize) {
        logger.info('Prompt optimization recommended', {
          recommendations: optimization.recommendations,
          estimatedSavings: optimization.estimatedSavings
        });
      }

      // Step 4: Execute with rate limiting
      const llmRequest: LLMRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.userRequest }
        ],
        ...(request.options?.temperature !== undefined && { temperature: request.options.temperature }),
        ...(request.options?.maxTokens !== undefined && { maxTokens: request.options.maxTokens }),
        ...(request.options?.model !== undefined && { model: request.options.model })
      };

      const llmResponse = await this.rateLimiter.executeWithRateLimit(
        () => this.provider.generateResponse(llmRequest),
        estimatedTokens,
        'medium'
      );

      // Step 5: Record token usage
      const estimatedCost = this.provider.calculateCost({
        promptTokens: llmResponse.tokensUsed.prompt,
        completionTokens: llmResponse.tokensUsed.completion,
        totalTokens: llmResponse.tokensUsed.total
      });

      const tokenUsage: ManagerTokenUsage = {
        promptTokens: llmResponse.tokensUsed.prompt,
        completionTokens: llmResponse.tokensUsed.completion,
        totalTokens: llmResponse.tokensUsed.total,
        estimatedCost
      };

      this.tokenManager.recordUsage(tokenUsage);

      // Step 6: Parse and validate response
      const parsedResponse = this.promptEngineer.parseResponse(llmResponse.content);
      const validation = this.responseParser.parseAndValidateResponse(parsedResponse);

      // Step 7: Get updated budget status
      const budgetStatus = this.tokenManager.getBudgetStatus();

      logger.info('Structured request processed successfully', {
        userRequest: request.userRequest.substring(0, 100),
        provider: this.provider.getProviderName(),
        commandCount: parsedResponse.commands.length,
        validCommands: validation.validCommands.length,
        invalidCommands: validation.invalidCommands.length,
        tokenUsage,
        budgetStatus: budgetStatus.isNearLimit ? 'near-limit' : 'ok'
      });

      return {
        response: parsedResponse,
        validation,
        tokenUsage,
        budgetStatus,
        providerUsed: this.provider.getProviderName()
      };

    } catch (error) {
      logger.error('Structured request processing failed', { error, request });
      throw error;
    }
  }

  /**
   * Generate a simple response without full orchestration
   */
  async generateSimpleResponse(request: LLMRequest): Promise<LLMResponse> {
    const estimatedTokens = this.provider.estimateTokens(
      request.messages.map(m => m.content).join(' ')
    );

    const budgetCheck = this.tokenManager.checkBudget(estimatedTokens);
    if (!budgetCheck.canProceed) {
      throw new Error(budgetCheck.reason || 'Token budget exceeded');
    }

    return this.rateLimiter.executeWithRateLimit(
      () => this.provider.generateResponse(request),
      estimatedTokens,
      'medium'
    );
  }

  /**
   * Get system status including provider health, rate limits, token usage, etc.
   */
  async getSystemStatus(): Promise<OrchestrationSystemStatus> {
    const rateLimiterStatus = this.rateLimiter.getStatus();
    const tokenStatus = this.tokenManager.getBudgetStatus();
    const providerHealthy = await this.provider.healthCheck();

    const isHealthy = providerHealthy &&
                     !tokenStatus.isNearLimit &&
                     rateLimiterStatus.consecutiveErrors < 3 &&
                     rateLimiterStatus.queueLength < 10;

    return {
      provider: {
        name: this.provider.getProviderName(),
        isHealthy: providerHealthy,
        capabilities: this.provider.getCapabilities()
      },
      rateLimiter: rateLimiterStatus,
      tokenManager: tokenStatus,
      isHealthy
    };
  }

  /**
   * Switch to a different LLM provider
   */
  switchProvider(newProvider: LLMProvider): void {
    const oldProviderName = this.provider.getProviderName();
    
    // Clean up old provider
    this.provider.destroy();
    
    // Set new provider
    this.provider = newProvider;
    
    logger.info('LLM provider switched', {
      from: oldProviderName,
      to: newProvider.getProviderName(),
      capabilities: newProvider.getCapabilities()
    });
  }

  /**
   * Get current provider
   */
  getProvider(): LLMProvider {
    return this.provider;
  }

  /**
   * Clean up resources and stop background processes
   */
  destroy(): void {
    this.provider.destroy();
    this.rateLimiter.destroy();
    logger.info('LLM Orchestrator destroyed and resources cleaned up');
  }
}
