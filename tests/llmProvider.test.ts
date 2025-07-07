import { LLMProvider, LLMRequest, LLMResponse, LLMProviderConfig, LLMCapabilities, LLMTokenUsage } from '../src/core/llm/LLMProvider';

// Mock logger for tests
const mockLogger = {
  child: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
};

// Concrete implementation for testing the abstract class
class TestLLMProvider extends LLMProvider {
  constructor(config: LLMProviderConfig, logger: any = mockLogger) {
    super(config, logger);
  }

  getProviderName(): string {
    return 'test-provider';
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 4096,
      supportedModels: ['test-model-1', 'test-model-2'],
      supportsStreaming: true,
      supportsVision: false,
      supportsTools: true,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000
      }
    };
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    // Mock implementation
    return {
      content: `Test response to: ${request.messages[request.messages.length - 1]?.content || 'unknown'}`,
      tokensUsed: {
        prompt: 50,
        completion: 25,
        total: 75
      },
      model: this.config.model,
      finishReason: 'stop',
      metadata: { testMetadata: true }
    };
  }

  estimateTokens(text: string): number {
    // Simple approximation for testing
    return Math.ceil(text.length / 4);
  }

  calculateCost(tokensUsed: LLMTokenUsage): number {
    // Mock cost calculation: $0.002 per 1000 tokens
    return (tokensUsed.totalTokens / 1000) * 0.002;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  destroy(): void {
    // Mock cleanup
  }
}

describe('LLMProvider', () => {
  let provider: TestLLMProvider;
  let config: LLMProviderConfig;

  beforeEach(() => {
    config = {
      apiKey: 'test-api-key',
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 1000,
      additionalConfig: { testParam: 'value' }
    };
    provider = new TestLLMProvider(config);
  });

  afterEach(() => {
    provider.destroy();
  });

  describe('constructor', () => {
    it('should initialize with config and logger', () => {
      expect(provider).toBeDefined();
      expect(provider.getConfig()).toEqual(config);
    });

    it('should create child logger with provider name', () => {
      expect(mockLogger.child).toHaveBeenCalledWith({ component: 'llm-test-provider' });
    });
  });

  describe('getProviderName', () => {
    it('should return provider name', () => {
      expect(provider.getProviderName()).toBe('test-provider');
    });
  });

  describe('getCapabilities', () => {
    it('should return provider capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(capabilities.maxTokens).toBe(4096);
      expect(capabilities.supportedModels).toContain('test-model-1');
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.rateLimit.requestsPerMinute).toBe(60);
    });
  });

  describe('generateResponse', () => {
    it('should generate response for valid request', async () => {
      const request: LLMRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello, world!' }
        ],
        temperature: 0.5,
        maxTokens: 500
      };

      const response = await provider.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.content).toContain('Hello, world!');
      expect(response.tokensUsed.total).toBe(75);
      expect(response.model).toBe('test-model');
      expect(response.finishReason).toBe('stop');
    });

    it('should handle requests with minimal structure', async () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Simple test' }
        ]
      };

      const response = await provider.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.content).toContain('Simple test');
    });

    it('should handle empty message arrays', async () => {
      const request: LLMRequest = {
        messages: []
      };

      const response = await provider.generateResponse(request);

      expect(response).toBeDefined();
      expect(response.content).toContain('unknown');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens for text', () => {
      const text = 'This is a test message with some content.';
      const tokens = provider.estimateTokens(text);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('should handle empty text', () => {
      const tokens = provider.estimateTokens('');
      expect(tokens).toBe(0);
    });

    it('should handle long text', () => {
      const longText = 'A'.repeat(1000);
      const tokens = provider.estimateTokens(longText);
      expect(tokens).toBe(250); // 1000/4 = 250
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for token usage', () => {
      const tokensUsed: LLMTokenUsage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        estimatedCost: 0.0003
      };

      const cost = provider.calculateCost(tokensUsed);
      
      expect(cost).toBeCloseTo(0.0003, 6); // 150/1000 * 0.002 = 0.0003
    });

    it('should handle zero tokens', () => {
      const tokensUsed: LLMTokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };

      const cost = provider.calculateCost(tokensUsed);
      expect(cost).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const isHealthy = await provider.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
      expect(isHealthy).toBe(true);
    });
  });

  describe('configuration management', () => {
    it('should get current configuration', () => {
      const currentConfig = provider.getConfig();
      
      expect(currentConfig).toEqual(config);
      expect(currentConfig).not.toBe(config); // Should be a copy
    });

    it('should update configuration', () => {
      const updates = {
        temperature: 0.9,
        maxTokens: 2000
      };

      provider.updateConfig(updates);
      const updatedConfig = provider.getConfig();

      expect(updatedConfig.temperature).toBe(0.9);
      expect(updatedConfig.maxTokens).toBe(2000);
      expect(updatedConfig.apiKey).toBe('test-api-key'); // Should preserve other values
    });

    it('should handle partial configuration updates', () => {
      const updates = { temperature: 0.1 };

      provider.updateConfig(updates);
      const updatedConfig = provider.getConfig();

      expect(updatedConfig.temperature).toBe(0.1);
      expect(updatedConfig.model).toBe('test-model'); // Should preserve unchanged values
    });
  });

  describe('destroy', () => {
    it('should clean up resources', () => {
      expect(() => provider.destroy()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle configuration with missing optional fields', () => {
      const minimalConfig: LLMProviderConfig = {
        apiKey: 'test-key',
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 1000
      };

      const minimalProvider = new TestLLMProvider(minimalConfig);
      
      expect(minimalProvider.getConfig()).toEqual(minimalConfig);
      minimalProvider.destroy();
    });
  });
});
