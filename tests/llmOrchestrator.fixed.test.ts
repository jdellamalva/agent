import { LLMOrchestrator } from '../src/core/llm/LLMOrchestrator';
import { LLMProvider, LLMRequest, LLMResponse, LLMProviderConfig, LLMCapabilities } from '../src/core/llm/LLMProvider';

// Mock the dependencies
jest.mock('../src/core/promptEngineer', () => ({
  PromptEngineer: jest.fn().mockImplementation(() => ({
    generateSystemPrompt: jest.fn().mockReturnValue('Mock system prompt'),
    parseResponse: jest.fn().mockReturnValue({
      commands: [
        { type: 'test-command', params: {} }
      ],
      reasoning: 'Mock reasoning',
      confidence: 0.95
    })
  }))
}));
jest.mock('../src/core/responseParser', () => ({
  ResponseParser: jest.fn().mockImplementation(() => ({
    parseAndValidateResponse: jest.fn().mockReturnValue({
      validCommands: [
        { type: 'test-command', params: {} }
      ],
      invalidCommands: [],
      errors: [],
      warnings: []
    })
  }))
}));
jest.mock('../src/core/tokenManager', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({
    checkBudget: jest.fn().mockReturnValue({
      canProceed: true,
      budgetStatus: {
        dailyRemaining: 50000,
        monthlyRemaining: 1500000,
        dailyPercentUsed: 50,
        monthlyPercentUsed: 25
      }
    }),
    recordUsage: jest.fn(),
    getBudgetStatus: jest.fn().mockReturnValue({
      isNearLimit: false,
      daily: { remaining: 50000, percentUsed: 50 },
      monthly: { remaining: 1500000, percentUsed: 25 }
    }),
    estimateTokens: jest.fn().mockReturnValue(100),
    analyzeForOptimization: jest.fn().mockReturnValue({
      shouldOptimize: false,
      recommendations: [],
      estimatedSavings: 0
    })
  }))
}));
jest.mock('../src/core/rateLimiter', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    checkLimit: jest.fn().mockResolvedValue(true),
    recordRequest: jest.fn(),
    getStatus: jest.fn().mockReturnValue({
      consecutiveErrors: 0,
      queueLength: 0,
      isHealthy: true
    }),
    executeWithRateLimit: jest.fn().mockImplementation(async (fn) => await fn()),
    destroy: jest.fn()
  }))
}));
jest.mock('../src/utils/logger', () => ({
  agentLogger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

// Mock LLM Provider implementation
class MockLLMProvider extends LLMProvider {
  private shouldFail = false;
  private responseDelay = 0;

  constructor(private name: string = 'mock-provider') {
    super({
      apiKey: 'test-key',
      model: 'test-model',
      temperature: 0.7,
      maxTokens: 1000
    }, { child: () => ({ info: jest.fn(), error: jest.fn() }) });
  }

  getProviderName(): string {
    return this.name;
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 4096,
      supportedModels: ['test-model'],
      supportsStreaming: false,
      supportsVision: false,
      supportsTools: false,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 100000
      }
    };
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    if (this.shouldFail) {
      throw new Error('Mock provider error');
    }

    // Simulate delay if specified
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }

    return {
      content: `Mock response to: ${request.messages[request.messages.length - 1]!.content}`,
      tokensUsed: {
        prompt: 100,
        completion: 50,
        total: 150
      },
      model: 'mock-model',
      finishReason: 'stop'
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  calculateCost(tokensUsed: any): number {
    return tokensUsed.totalTokens * 0.002;
  }

  async healthCheck(): Promise<boolean> {
    return !this.shouldFail;
  }

  destroy(): void {
    // Mock cleanup
  }

  // Test helper methods
  setFailure(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }

  setDelay(delay: number) {
    this.responseDelay = delay;
  }
}

describe('LLMOrchestrator', () => {
  let orchestrator: LLMOrchestrator;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    orchestrator = new LLMOrchestrator(mockProvider);
  });

  afterEach(() => {
    if (orchestrator) {
      orchestrator.destroy();
    }
  });

  describe('initialization', () => {
    it('should create orchestrator with provider', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getProvider()).toBe(mockProvider);
    });

    it('should get provider name from underlying provider', () => {
      const provider = orchestrator.getProvider();
      expect(provider.getProviderName()).toBe('mock-provider');
    });
  });

  describe('processStructuredRequest', () => {
    it('should process a basic request', async () => {
      const request = {
        userRequest: 'Create a new file'
      };

      const result = await orchestrator.processStructuredRequest(request);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response.commands).toBeDefined();
      expect(result.tokenUsage).toBeDefined();
      expect(result.budgetStatus).toBeDefined();
      expect(result.providerUsed).toBe('mock-provider');
    });

    it('should handle requests with context', async () => {
      const request = {
        userRequest: 'Help me with this task',
        context: {
          projectContext: 'Node.js project',
          conversationHistory: ['Previous request']
        }
      };

      const result = await orchestrator.processStructuredRequest(request);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
      expect(result.response.commands).toBeDefined();
    });

    it('should handle requests with options', async () => {
      const request = {
        userRequest: 'Continue the previous task',
        options: {
          temperature: 0.9,
          maxTokens: 2000,
          model: 'gpt-4'
        }
      };

      const result = await orchestrator.processStructuredRequest(request);

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });
  });

  describe('generateSimpleResponse', () => {
    it('should generate simple responses', async () => {
      const request: LLMRequest = {
        messages: [
          { role: 'user', content: 'Hello, world!' }
        ]
      };

      const result = await orchestrator.generateSimpleResponse(request);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.tokensUsed).toBeDefined();
      expect(result.model).toBe('mock-model');
    });
  });

  describe('getSystemStatus', () => {
    it('should return system status', async () => {
      const status = await orchestrator.getSystemStatus();

      expect(status).toBeDefined();
      expect(status.provider).toBeDefined();
      expect(status.provider.name).toBe('mock-provider');
      expect(status.provider.isHealthy).toBe(true);
      expect(status.rateLimiter).toBeDefined();
      expect(status.tokenManager).toBeDefined();
      expect(status.isHealthy).toBeDefined();
    });
  });

  describe('provider switching', () => {
    it('should switch providers', () => {
      const newProvider = new MockLLMProvider('new-provider');
      
      orchestrator.switchProvider(newProvider);
      
      expect(orchestrator.getProvider().getProviderName()).toBe('new-provider');
    });
  });

  describe('error handling', () => {
    it('should handle provider errors gracefully', async () => {
      mockProvider.setFailure(true);
      
      const request = {
        userRequest: 'This should fail'
      };

      await expect(orchestrator.processStructuredRequest(request))
        .rejects.toThrow('Mock provider error');
    });

    it('should handle timeout scenarios', async () => {
      mockProvider.setDelay(100); // Short delay for testing
      
      const request = {
        userRequest: 'This should timeout'
      };

      const result = await orchestrator.processStructuredRequest(request);
      expect(result).toBeDefined();
    });
  });

  describe('complex scenarios', () => {
    it('should handle complex multi-step requests', async () => {
      const request = {
        userRequest: 'Analyze this codebase and suggest improvements',
        context: {
          projectContext: 'Large TypeScript project with React frontend',
          conversationHistory: [
            'Previous analysis request',
            'User asked for performance optimization'
          ]
        },
        options: {
          temperature: 0.1, // Lower for more deterministic responses
          maxTokens: 4000
        }
      };

      const result = await orchestrator.processStructuredRequest(request);

      expect(result).toBeDefined();
      expect(result.response.commands).toBeDefined();
      expect(result.tokenUsage.totalTokens).toBeGreaterThan(0);
    });

    it('should handle simple requests', async () => {
      const request = {
        userRequest: 'Simple request'
      };

      const result = await orchestrator.processStructuredRequest(request);

      expect(result).toBeDefined();
      expect(result.response.commands).toBeDefined();
    });

    it('should handle requests without context', async () => {
      const request = {
        userRequest: 'Request without context'
      };

      const result = await orchestrator.processStructuredRequest(request);

      expect(result).toBeDefined();
      expect(result.response.commands).toBeDefined();
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 3 }, (_, index) => ({
        userRequest: `Concurrent request ${index + 1}`
      }));

      const results = await Promise.all(
        requests.map(request => orchestrator.processStructuredRequest(request))
      );

      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.response.commands).toBeDefined();
      });
    });
  });

  describe('provider abstraction', () => {
    it('should work with custom provider implementation', async () => {
      class CustomProvider extends LLMProvider {
        constructor() {
          super({
            apiKey: 'custom-key',
            model: 'custom-model',
            temperature: 0.5,
            maxTokens: 2000
          }, { child: () => ({ info: jest.fn(), error: jest.fn() }) });
        }

        getProviderName(): string {
          return 'custom-ai-provider';
        }

        getCapabilities(): LLMCapabilities {
          return {
            maxTokens: 8192,
            supportedModels: ['custom-model'],
            supportsStreaming: true,
            supportsVision: false,
            supportsTools: true,
            rateLimit: {
              requestsPerMinute: 100,
              tokensPerMinute: 200000
            }
          };
        }

        async generateResponse(request: LLMRequest): Promise<LLMResponse> {
          return {
            content: `Custom AI response: ${request.messages[request.messages.length - 1]!.content!.toUpperCase()}`,
            tokensUsed: {
              prompt: 75,
              completion: 25,
              total: 100
            },
            model: 'custom-model',
            finishReason: 'stop'
          };
        }

        estimateTokens(text: string): number {
          return Math.floor(text.length / 3);
        }

        calculateCost(tokensUsed: any): number {
          return tokensUsed.totalTokens * 0.001;
        }

        async healthCheck(): Promise<boolean> {
          return true;
        }

        destroy(): void {
          // Custom cleanup
        }
      }

      const customOrchestrator = new LLMOrchestrator(new CustomProvider());

      const request = {
        userRequest: 'test message'
      };

      const result = await customOrchestrator.processStructuredRequest(request);

      expect(result).toBeDefined();
      expect(result.providerUsed).toBe('custom-ai-provider');
      expect(customOrchestrator.getProvider().getProviderName()).toBe('custom-ai-provider');

      customOrchestrator.destroy();
    });
  });
});
