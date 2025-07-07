/**
 * LLM Provider Interface
 * 
 * This interface defines the contract that all LLM providers must implement
 * to be used within the agent system. It provides a unified API for 
 * interacting with different LLM services.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  metadata?: Record<string, any>;
}

export interface LLMResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  finishReason: string;
  metadata?: Record<string, any>;
}

export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

export interface LLMCapabilities {
  maxTokens: number;
  supportedModels: string[];
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  rateLimit: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  additionalConfig?: Record<string, any>;
}

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMProvider {
  protected config: LLMProviderConfig;
  protected logger: any;

  constructor(config: LLMProviderConfig, logger: any) {
    this.config = config;
    this.logger = logger.child({ component: `llm-${this.getProviderName()}` });
  }

  /**
   * Get the provider name (e.g., 'openai', 'anthropic', 'azure')
   */
  abstract getProviderName(): string;

  /**
   * Get the capabilities of this provider
   */
  abstract getCapabilities(): LLMCapabilities;

  /**
   * Generate a response from the LLM
   */
  abstract generateResponse(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Estimate tokens for a given text
   */
  abstract estimateTokens(text: string): number;

  /**
   * Calculate estimated cost for token usage
   */
  abstract calculateCost(tokensUsed: LLMTokenUsage): number;

  /**
   * Health check for the provider
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Clean up resources
   */
  abstract destroy(): void;

  /**
   * Get current configuration
   */
  getConfig(): LLMProviderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LLMProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

/**
 * Factory function type for creating LLM providers
 */
export type LLMProviderFactory = (config: LLMProviderConfig, logger: any) => LLMProvider;

/**
 * Registry for LLM provider factories
 */
export class LLMProviderRegistry {
  private static factories: Map<string, LLMProviderFactory> = new Map();

  /**
   * Register a new LLM provider factory
   */
  static registerProvider(name: string, factory: LLMProviderFactory): void {
    this.factories.set(name, factory);
  }

  /**
   * Create a provider instance
   */
  static createProvider(name: string, config: LLMProviderConfig, logger: any): LLMProvider {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Unknown LLM provider: ${name}`);
    }
    return factory(config, logger);
  }

  /**
   * Get available provider names
   */
  static getAvailableProviders(): string[] {
    return Array.from(this.factories.keys());
  }

  /**
   * Check if a provider is registered
   */
  static hasProvider(name: string): boolean {
    return this.factories.has(name);
  }
}
