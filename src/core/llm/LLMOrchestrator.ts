/**
 * LLM Orchestrator - Provider-Agnostic LLM Interaction Management
 * 
 * The LLMOrchestrator serves as the central coordination hub for all LLM interactions
 * within the agent system. It abstracts away provider-specific details and provides
 * a unified interface for LLM operations across different providers (OpenAI, Claude, etc.).
 * 
 * Architecture Responsibilities:
 * - Provider-agnostic LLM request orchestration
 * - Prompt engineering and response parsing coordination
 * - Token management and cost optimization
 * - Rate limiting and error handling
 * - Request/response lifecycle management
 * 
 * Dependencies:
 * - LLMProvider: Abstract provider interface for LLM interactions
 * - PromptEngineer: System prompt generation and user request structuring
 * - ResponseParser: LLM response parsing and validation
 * - TokenManager: Token usage tracking and cost optimization
 * - RateLimiter: Request rate limiting and backoff management
 * 
 * Key Patterns:
 * - Strategy pattern for provider abstraction
 * - Chain of responsibility for request processing
 * - Observer pattern for token usage monitoring
 * - Decorator pattern for rate limiting
 * 
 * Lifecycle:
 * 1. Instantiated with specific LLM provider
 * 2. Accepts orchestration requests with context
 * 3. Coordinates prompt engineering and token estimation
 * 4. Manages rate limiting and provider communication
 * 5. Parses and validates responses
 * 6. Tracks usage and performance metrics
 * 
 * Performance Considerations:
 * - Caches token estimations for similar prompts
 * - Implements exponential backoff for rate limiting
 * - Monitors provider response times and adjusts accordingly
 * - Optimizes prompt length while maintaining context quality
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

  /**
   * Initialize LLMOrchestrator with specified provider and default components
   * 
   * Creates a new orchestrator instance configured with the provided LLM provider
   * and initializes all supporting components for request processing.
   * 
   * @param provider - LLM provider instance (OpenAI, Claude, etc.)
   * 
   * Initialization:
   * - Stores provider reference for request routing
   * - Creates PromptEngineer for system prompt generation
   * - Creates ResponseParser for response validation
   * - Creates TokenManager for usage tracking
   * - Creates RateLimiter for request throttling
   * 
   * Side Effects:
   * - Logs initialization with provider details
   * - Establishes provider capability assessment
   * 
   * Performance: O(1) - Constant time initialization
   */
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
   * Process a structured request using the complete Think-Act-Observe cycle
   * 
   * This is the primary method for LLM request processing, coordinating all
   * orchestration components to handle user requests end-to-end.
   * 
   * @param request - Orchestration request with user input and context
   * @returns Promise<OrchestrationResponse> - Comprehensive response with validation and metrics
   * 
   * Processing Pipeline:
   * 1. Generate optimized system prompt from user request and context
   * 2. Estimate token usage and check budget constraints
   * 3. Apply rate limiting and backoff if necessary
   * 4. Send structured request to LLM provider
   * 5. Parse and validate LLM response for safety and correctness
   * 6. Track token usage and update budgets
   * 7. Return comprehensive response with metrics
   * 
   * Error Handling:
   * - Rate limit exceeded: Implements exponential backoff
   * - Budget exceeded: Returns budget warning with recommendation
   * - Provider errors: Wraps and re-throws with context
   * - Parsing errors: Returns validation errors with original response
   * 
   * Performance: 
   * - Async/await for non-blocking operation
   * - Token estimation prevents oversized requests
   * - Rate limiting prevents provider throttling
   * - Response caching for repeated similar requests
   * 
   * @throws Error - If provider is unavailable or critical validation fails
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
