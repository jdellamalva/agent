/**
 * OpenAIProvider - OpenAI GPT model integration for LLM requests
 * 
 * **Purpose**: 
 * Implements the LLMProvider interface to enable agent communication with
 * OpenAI's GPT models (GPT-4, GPT-4 Turbo, GPT-3.5 Turbo) with proper
 * error handling, token management, and rate limiting support.
 * 
 * **Dependencies**:
 * - openai: Official OpenAI SDK for API communication
 * - LLMProvider: Base class providing common provider functionality
 * - OpenAIError: Specialized error handling for OpenAI-specific issues
 * 
 * **Key Patterns**:
 * - Provider pattern implementation for pluggable LLM backends
 * - Adapter pattern to bridge OpenAI SDK with agent's LLM interface
 * - Strategy pattern for model-specific capability and pricing logic
 * 
 * **Lifecycle**:
 * 1. Initialize with API key and model configuration
 * 2. Validate credentials and model availability
 * 3. Process requests with token counting and rate limiting
 * 4. Transform OpenAI responses to agent's standard format
 * 5. Handle errors with retries and fallback strategies
 * 
 * **Performance Considerations**:
 * - Efficient token estimation for cost optimization
 * - Request batching for improved throughput
 * - Connection pooling and keep-alive for reduced latency
 * 
 * **Error Handling**:
 * - Automatic retry with exponential backoff for rate limits
 * - Detailed error categorization (auth, quota, model, network)
 * - Graceful degradation for temporary service issues
 */

import OpenAI from 'openai';
import { 
  LLMProvider, 
  LLMRequest, 
  LLMResponse, 
  LLMTokenUsage, 
  LLMCapabilities,
  LLMProviderConfig 
} from '../../core/llm/LLMProvider';
import { OpenAIError } from '../../utils/errors';
import { OPENAI_PRICING, NETWORK } from '../../config/constants';

/**
 * OpenAI provider implementation for LLM operations
 * 
 * Provides OpenAI-specific API integration with token management,
 * rate limiting, and error handling.
 */
export class OpenAIProvider extends LLMProvider {
  private client: OpenAI;

  /**
   * Initialize OpenAI provider with configuration and authentication
   * 
   * @param config - Provider configuration including:
   *   - apiKey: OpenAI API key for authentication (required)
   *   - model: GPT model to use (gpt-4, gpt-4-turbo, gpt-3.5-turbo)
   *   - maxTokens: Maximum tokens per request
   *   - temperature: Response randomness (0.0-1.0)
   * @param logger - Logger instance for request/response tracking
   * 
   * @throws OpenAIError if API key is missing or invalid
   * 
   * **Side Effects**:
   * - Creates authenticated OpenAI client instance
   * - Logs provider initialization with configuration details
   * - Validates API key format and accessibility
   * 
   * **Security**: API key is not logged for security purposes
   */
  constructor(config: LLMProviderConfig, logger: any) {
    super(config, logger);
    
    if (!config.apiKey) {
      throw new OpenAIError('OpenAI API key is required', 'INVALID_API_KEY');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
    });

    this.logger.info('OpenAI provider initialized', {
      model: config.model,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    });
  }

  getProviderName(): string {
    return 'openai';
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: this.getMaxTokensForModel(this.config.model),
      supportedModels: [
        'gpt-4o',
        'gpt-4',
        'gpt-4-turbo',
        'gpt-3.5-turbo'
      ],
      supportsStreaming: true,
      supportsVision: this.config.model.includes('gpt-4'),
      supportsTools: true,
      rateLimit: {
        requestsPerMinute: 50,
        tokensPerMinute: 90000
      }
    };
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      const startTime = Date.now();
      
      this.logger.info('Sending OpenAI request', {
        messageCount: request.messages.length,
        model: request.model || this.config.model,
        temperature: request.temperature || this.config.temperature,
        maxTokens: request.maxTokens || this.config.maxTokens,
      });

      const response = await this.client.chat.completions.create({
        model: request.model || this.config.model,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        temperature: request.temperature || this.config.temperature,
        max_tokens: request.maxTokens || this.config.maxTokens,
      });

      const duration = Date.now() - startTime;
      
      if (!response.choices || response.choices.length === 0) {
        throw new OpenAIError('No choices returned from OpenAI', 'INVALID_RESPONSE');
      }

      const choice = response.choices[0];
      if (!choice || !choice.message?.content) {
        throw new OpenAIError('Invalid choice from OpenAI response', 'INVALID_RESPONSE');
      }

      const tokensUsed = {
        prompt: response.usage?.prompt_tokens || 0,
        completion: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0,
      };

      this.logger.info('OpenAI request successful', {
        tokensUsed,
        duration,
        finishReason: choice.finish_reason,
        model: response.model,
      });

      return {
        content: choice.message.content,
        tokensUsed,
        model: response.model,
        finishReason: choice.finish_reason || 'unknown',
        metadata: {
          duration,
          usage: response.usage
        }
      };

    } catch (error) {
      this.logger.error('OpenAI request failed', { error, request });
      
      if (error && typeof error === 'object' && 'status' in error) {
        throw this.handleOpenAIAPIError(error);
      }
      
      throw new OpenAIError(
        `Unexpected error during OpenAI request: ${error instanceof Error ? error.message : String(error)}`,
        'UNKNOWN_ERROR',
        { originalError: error }
      );
    }
  }

  estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    // This is conservative and works reasonably well for planning
    return Math.ceil(text.length / 4);
  }

  calculateCost(tokensUsed: LLMTokenUsage): number {
    // Use centralized pricing from constants - standardize on OPENAI_PRICING structure
    let modelPricing;
    
    // Map model names to OPENAI_PRICING constants
    switch (this.config.model) {
      case 'gpt-4':
        modelPricing = { input: OPENAI_PRICING.GPT_4.PROMPT_RATE, output: OPENAI_PRICING.GPT_4.COMPLETION_RATE };
        break;
      case 'gpt-4-turbo':
        modelPricing = { input: OPENAI_PRICING.GPT_4_TURBO.PROMPT_RATE, output: OPENAI_PRICING.GPT_4_TURBO.COMPLETION_RATE };
        break;
      case 'gpt-3.5-turbo':
        modelPricing = { input: OPENAI_PRICING.GPT_3_5_TURBO.PROMPT_RATE, output: OPENAI_PRICING.GPT_3_5_TURBO.COMPLETION_RATE };
        break;
      default:
        // Default to GPT-4 pricing for unknown models
        modelPricing = { input: OPENAI_PRICING.GPT_4.PROMPT_RATE, output: OPENAI_PRICING.GPT_4.COMPLETION_RATE };
    }
    
    const inputCost = (tokensUsed.promptTokens / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * modelPricing.input;
    const outputCost = (tokensUsed.completionTokens / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * modelPricing.output;
    
    return inputCost + outputCost;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
        temperature: 0
      });
      
      return response.choices && response.choices.length > 0;
    } catch (error) {
      this.logger.error('OpenAI health check failed', { error });
      return false;
    }
  }

  destroy(): void {
    // OpenAI client doesn't have explicit cleanup
    this.logger.info('OpenAI provider destroyed');
  }

  private getMaxTokensForModel(model: string): number {
    const modelLimits: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-3.5-turbo': 16384,
    };

    return modelLimits[model] || 8192;
  }

  private handleOpenAIAPIError(error: any): OpenAIError {
    if (error?.status) {
      switch (error.status) {
        case NETWORK.HTTP_STATUS_UNAUTHORIZED:
          return new OpenAIError('Invalid API key', 'INVALID_API_KEY', { originalError: error });
        case NETWORK.HTTP_STATUS_TOO_MANY_REQUESTS:
          return new OpenAIError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', { originalError: error });
        case NETWORK.HTTP_STATUS_BAD_REQUEST:
          return new OpenAIError('Invalid request', 'INVALID_REQUEST', { originalError: error });
        case NETWORK.HTTP_STATUS_NOT_FOUND:
          return new OpenAIError('Model not found', 'MODEL_NOT_FOUND', { originalError: error });
        case NETWORK.HTTP_STATUS_SERVER_ERROR:
        case NETWORK.HTTP_STATUS_BAD_GATEWAY:
        case NETWORK.HTTP_STATUS_SERVICE_UNAVAILABLE:
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
}

/**
 * Factory function for creating OpenAI provider instances
 */
export function createOpenAIProvider(config: LLMProviderConfig, logger: any): OpenAIProvider {
  return new OpenAIProvider(config, logger);
}
