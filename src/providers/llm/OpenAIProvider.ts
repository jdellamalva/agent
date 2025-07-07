/**
 * OpenAI Provider Implementation
 * 
 * Implements the LLMProvider interface for OpenAI's GPT models
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

export class OpenAIProvider extends LLMProvider {
  private client: OpenAI;

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
    // Pricing per 1K tokens (approximate, as of 2024)
    const pricing: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    };

    const modelPricing = pricing[this.config.model] || pricing['gpt-4']!; // Default to gpt-4 pricing
    
    const inputCost = (tokensUsed.promptTokens / 1000) * modelPricing.input;
    const outputCost = (tokensUsed.completionTokens / 1000) * modelPricing.output;
    
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
}

/**
 * Factory function for creating OpenAI provider instances
 */
export function createOpenAIProvider(config: LLMProviderConfig, logger: any): OpenAIProvider {
  return new OpenAIProvider(config, logger);
}
