import OpenAI from 'openai';
import { agentLogger } from '../utils/logger';
import { OpenAIError } from '../utils/errors';
import defaultConfig from '../utils/config';
import { PromptEngineer, SystemPromptContext, ParsedResponse } from '../core/promptEngineer';
import { ResponseParser } from '../core/responseParser';
import { TokenManager, TokenUsage as ManagerTokenUsage } from '../core/tokenManager';
import { RateLimiter } from '../core/rateLimiter';

const logger = agentLogger.child({ component: 'openai' });

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ChatCompletionResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

export class OpenAIClient {
  private client: OpenAI;
  private config: typeof defaultConfig;
  private promptEngineer: PromptEngineer;
  private responseParser: ResponseParser;
  private tokenManager: TokenManager;
  private rateLimiter: RateLimiter;

  constructor() {
    this.config = defaultConfig;
    
    if (!this.config.openai.apiKey) {
      throw new OpenAIError('OpenAI API key is required', 'INVALID_API_KEY');
    }

    this.client = new OpenAI({
      apiKey: this.config.openai.apiKey,
    });

    // Initialize the new systems
    this.promptEngineer = new PromptEngineer();
    this.responseParser = new ResponseParser();
    this.tokenManager = new TokenManager();
    this.rateLimiter = new RateLimiter();

    logger.info('OpenAI client initialized with advanced features', {
      model: this.config.openai.model,
      maxTokens: this.config.openai.maxTokens,
      temperature: this.config.openai.temperature,
    });
  }

  /**
   * Send a chat completion request to OpenAI
   */
  public async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    try {
      const startTime = Date.now();
      
      logger.info('Sending chat completion request', {
        messageCount: request.messages.length,
        model: request.model || this.config.openai.model,
        temperature: request.temperature || this.config.openai.temperature,
        maxTokens: request.maxTokens || this.config.openai.maxTokens,
      });

      const response = await this.client.chat.completions.create({
        model: request.model || this.config.openai.model,
        messages: request.messages,
        temperature: request.temperature || this.config.openai.temperature,
        max_tokens: request.maxTokens || this.config.openai.maxTokens,
      });

      const duration = Date.now() - startTime;
      
      if (!response.choices || response.choices.length === 0) {
        throw new OpenAIError('No choices returned from OpenAI', 'INVALID_RESPONSE');
      }

      const choice = response.choices[0];
      if (!choice) {
        throw new OpenAIError('Invalid choice from OpenAI response', 'INVALID_RESPONSE');
      }

      const content = choice.message?.content;
      
      if (!content) {
        throw new OpenAIError('No content in OpenAI response', 'INVALID_RESPONSE');
      }

      const tokensUsed = {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      };

      logger.info('Chat completion successful', {
        tokensUsed,
        duration,
        finishReason: choice.finish_reason,
        model: response.model,
      });

      return {
        content,
        tokensUsed,
        model: response.model,
        finishReason: choice.finish_reason || 'unknown',
      };

    } catch (error) {
      logger.error('Chat completion failed', { error, request });
      
      if (error && typeof error === 'object' && 'status' in error) {
        throw this.handleOpenAIAPIError(error);
      }
      
      throw new OpenAIError(
        `Unexpected error during chat completion: ${error instanceof Error ? error.message : String(error)}`,
        'UNKNOWN_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Handle OpenAI API errors and convert them to our error types
   */
  private handleOpenAIAPIError(error: any): OpenAIError {
    if (error?.status) {
      switch (error.status) {
        case 401:
          return new OpenAIError('Invalid API key', 'INVALID_API_KEY', { originalError: error });
        case 429:
          return new OpenAIError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', { originalError: error });
        case 400:
          return new OpenAIError('Invalid request', 'INVALID_REQUEST', { originalError: error });
        case 404:
          return new OpenAIError('Model not found', 'MODEL_NOT_FOUND', { originalError: error });
        case 500:
        case 502:
        case 503:
          return new OpenAIError('OpenAI server error', 'SERVER_ERROR', { originalError: error });
        default:
          return new OpenAIError(
            `OpenAI API error: ${error.message}`,
            'API_ERROR',
            { status: error.status, originalError: error }
          );
      }
    }
    
    return new OpenAIError(
      `OpenAI API error: ${error.message || String(error)}`,
      'API_ERROR',
      { originalError: error }
    );
  }

  /**
   * Calculate estimated cost for token usage
   * Note: These are approximate pricing tiers, actual costs may vary
   */
  public calculateEstimatedCost(tokensUsed: TokenUsage, model: string): number {
    // Pricing per 1K tokens (approximate, as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4']; // Default to gpt-4 pricing
    
    if (!modelPricing) {
      // Fallback pricing if model not found
      const fallbackPricing = { input: 0.03, output: 0.06 };
      const inputCost = (tokensUsed.promptTokens / 1000) * fallbackPricing.input;
      const outputCost = (tokensUsed.completionTokens / 1000) * fallbackPricing.output;
      return inputCost + outputCost;
    }
    
    const inputCost = (tokensUsed.promptTokens / 1000) * modelPricing.input;
    const outputCost = (tokensUsed.completionTokens / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }

  /**
   * Get the current configuration
   */
  public getConfig() {
    return {
      model: this.config.openai.model,
      maxTokens: this.config.openai.maxTokens,
      temperature: this.config.openai.temperature,
    };
  }

  /**
   * Process a structured request using the full Think-Act-Observe cycle
   */
  public async processStructuredRequest(
    userRequest: string,
    context?: {
      projectContext?: string;
      conversationHistory?: string[];
    }
  ): Promise<{
    response: ParsedResponse;
    validation: ReturnType<ResponseParser['parseAndValidateResponse']>;
    tokenUsage: ManagerTokenUsage;
    budgetStatus: ReturnType<TokenManager['getBudgetStatus']>;
  }> {
    try {
      // Step 1: Generate optimized system prompt
      const promptContext: SystemPromptContext = {
        userRequest,
        ...(context?.projectContext && { projectContext: context.projectContext }),
        ...(context?.conversationHistory && { conversationHistory: context.conversationHistory })
      };

      const systemPrompt = this.promptEngineer.generateSystemPrompt(promptContext);
      
      // Step 2: Check token budget and optimize if needed
      const estimatedTokens = this.tokenManager.estimateTokens(systemPrompt + userRequest);
      const budgetCheck = this.tokenManager.checkBudget(estimatedTokens);
      
      if (!budgetCheck.canProceed) {
        throw new OpenAIError(budgetCheck.reason || 'Token budget exceeded', 'TOKEN_BUDGET_EXCEEDED');
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
      const chatResponse = await this.rateLimiter.executeWithRateLimit(
        () => this.chatCompletion({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userRequest }
          ]
        }),
        estimatedTokens,
        'medium'
      );

      // Step 5: Record token usage
      const estimatedCost = this.calculateEstimatedCost({
        promptTokens: chatResponse.tokensUsed.prompt,
        completionTokens: chatResponse.tokensUsed.completion,
        totalTokens: chatResponse.tokensUsed.total
      }, chatResponse.model);

      const tokenUsage: ManagerTokenUsage = {
        promptTokens: chatResponse.tokensUsed.prompt,
        completionTokens: chatResponse.tokensUsed.completion,
        totalTokens: chatResponse.tokensUsed.total,
        estimatedCost
      };

      this.tokenManager.recordUsage(tokenUsage);

      // Step 6: Parse and validate response
      const parsedResponse = this.promptEngineer.parseResponse(chatResponse.content);
      const validation = this.responseParser.parseAndValidateResponse(parsedResponse);

      // Step 7: Get updated budget status
      const budgetStatus = this.tokenManager.getBudgetStatus();

      logger.info('Structured request processed successfully', {
        userRequest: userRequest.substring(0, 100),
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
        budgetStatus
      };

    } catch (error) {
      logger.error('Structured request processing failed', { error, userRequest });
      throw error;
    }
  }

  /**
   * Get system status including rate limits, token usage, etc.
   */
  public getSystemStatus(): {
    rateLimiter: ReturnType<RateLimiter['getStatus']>;
    tokenManager: ReturnType<TokenManager['getBudgetStatus']>;
    isHealthy: boolean;
  } {
    const rateLimiterStatus = this.rateLimiter.getStatus();
    const tokenStatus = this.tokenManager.getBudgetStatus();
    
    const isHealthy = !tokenStatus.isNearLimit && 
                     rateLimiterStatus.consecutiveErrors < 3 &&
                     rateLimiterStatus.queueLength < 10;

    return {
      rateLimiter: rateLimiterStatus,
      tokenManager: tokenStatus,
      isHealthy
    };
  }

  /**
   * Clean up resources and stop background processes
   * Call this when shutting down or in tests
   */
  public destroy(): void {
    this.rateLimiter.destroy();
    logger.info('OpenAIClient destroyed and resources cleaned up');
  }
}
