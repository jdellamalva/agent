import { OpenAIClient, ChatMessage } from '../src/integrations/openai';
import { OpenAIError } from '../src/utils/errors';

// Mock the OpenAI module
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }));
});

// Mock the config module
jest.mock('../src/utils/config', () => ({
  __esModule: true,
  defaultConfig: {
    openai: {
      apiKey: 'test-api-key',
      model: 'gpt-4o',
      maxTokens: 4000,
      temperature: 0.7
    }
  }
}));

// Mock the logger
jest.mock('../src/utils/logger', () => ({
  agentLogger: {
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }))
  }
}));

describe('OpenAIClient', () => {
  let client: OpenAIClient;
  let mockOpenAI: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Get the mocked OpenAI constructor
    const OpenAI = require('openai');
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
    OpenAI.mockImplementation(() => mockOpenAI);
    
    client = new OpenAIClient();
  });

  afterEach(() => {
    // Clean up resources to prevent Jest from hanging
    if (client && typeof client.destroy === 'function') {
      client.destroy();
    }
  });

  describe('constructor', () => {
    it('should initialize successfully with valid API key', () => {
      expect(client).toBeInstanceOf(OpenAIClient);
    });

    it('should throw error without API key', () => {
      // Mock config without API key
      jest.doMock('../src/utils/config', () => ({
        __esModule: true,
        defaultConfig: {
          openai: {
            apiKey: '',
            model: 'gpt-4o',
            maxTokens: 4000,
            temperature: 0.7
          }
        }
      }));

      // Re-require the module to get the new mock
      jest.resetModules();
      const { OpenAIClient: TestClient } = require('../src/integrations/openai');
      
      expect(() => new TestClient()).toThrow('OpenAI API key is required');
    });
  });

  describe('chatCompletion', () => {
    it('should successfully complete a chat request', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello, how can I help you?'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        },
        model: 'gpt-4o'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await client.chatCompletion({ messages });

      expect(result).toEqual({
        content: 'Hello, how can I help you?',
        tokensUsed: {
          prompt: 10,
          completion: 15,
          total: 25
        },
        model: 'gpt-4o',
        finishReason: 'stop'
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages,
        temperature: 0.7,
        max_tokens: 4000
      });
    });

    it('should handle empty choices response', async () => {
      const mockResponse = {
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        model: 'gpt-4o'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(client.chatCompletion({ messages })).rejects.toThrow(OpenAIError);
      await expect(client.chatCompletion({ messages })).rejects.toThrow('No choices returned from OpenAI');
    });

    it('should handle missing content in response', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null
            },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        model: 'gpt-4o'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(client.chatCompletion({ messages })).rejects.toThrow(OpenAIError);
      await expect(client.chatCompletion({ messages })).rejects.toThrow('No content in OpenAI response');
    });

    it('should handle API errors correctly - 401 Unauthorized', async () => {
      const apiError = {
        status: 401,
        message: 'Invalid API key'
      };

      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(client.chatCompletion({ messages })).rejects.toThrow(OpenAIError);
      await expect(client.chatCompletion({ messages })).rejects.toThrow('Invalid API key');
    });

    it('should handle API errors correctly - 429 Rate Limited', async () => {
      const apiError = {
        status: 429,
        message: 'Rate limit exceeded'
      };

      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(client.chatCompletion({ messages })).rejects.toThrow(OpenAIError);
      await expect(client.chatCompletion({ messages })).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Network error');

      mockOpenAI.chat.completions.create.mockRejectedValue(genericError);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(client.chatCompletion({ messages })).rejects.toThrow(OpenAIError);
      await expect(client.chatCompletion({ messages })).rejects.toThrow('Unexpected error during chat completion');
    });

    it('should use custom parameters when provided', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        model: 'gpt-3.5-turbo'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      const customRequest = {
        messages,
        temperature: 0.5,
        maxTokens: 1000,
        model: 'gpt-3.5-turbo'
      };

      await client.chatCompletion(customRequest);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages,
        temperature: 0.5,
        max_tokens: 1000
      });
    });

    it('should handle missing usage data gracefully', async () => {
      const mockResponse = {
        choices: [
          {
            message: { content: 'Response' },
            finish_reason: 'stop'
          }
        ],
        usage: null,
        model: 'gpt-4o'
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await client.chatCompletion({ messages });

      expect(result.tokensUsed).toEqual({
        prompt: 0,
        completion: 0,
        total: 0
      });
    });
  });

  describe('calculateEstimatedCost', () => {
    it('should calculate cost for gpt-4o', () => {
      const tokensUsed = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };

      const cost = client.calculateEstimatedCost(tokensUsed, 'gpt-4o');
      
      // Expected: (1000/1000 * 0.005) + (500/1000 * 0.015) = 0.005 + 0.0075 = 0.0125
      expect(cost).toBeCloseTo(0.0125, 4);
    });

    it('should calculate cost for gpt-4', () => {
      const tokensUsed = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };

      const cost = client.calculateEstimatedCost(tokensUsed, 'gpt-4');
      
      // Expected: (1000/1000 * 0.03) + (500/1000 * 0.06) = 0.03 + 0.03 = 0.06
      expect(cost).toBeCloseTo(0.06, 4);
    });

    it('should calculate cost for gpt-3.5-turbo', () => {
      const tokensUsed = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };

      const cost = client.calculateEstimatedCost(tokensUsed, 'gpt-3.5-turbo');
      
      // Expected: (1000/1000 * 0.001) + (500/1000 * 0.002) = 0.001 + 0.001 = 0.002
      expect(cost).toBeCloseTo(0.002, 4);
    });

    it('should use fallback pricing for unknown models', () => {
      const tokensUsed = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };

      const cost = client.calculateEstimatedCost(tokensUsed, 'unknown-model');
      
      // Expected: fallback to gpt-4 pricing (1000/1000 * 0.03) + (500/1000 * 0.06) = 0.03 + 0.03 = 0.06
      expect(cost).toBeCloseTo(0.06, 4);
    });

    it('should handle edge case with zero tokens', () => {
      const tokensUsed = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      };

      const cost = client.calculateEstimatedCost(tokensUsed, 'gpt-4o');
      
      expect(cost).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = client.getConfig();
      
      expect(config).toEqual({
        model: 'gpt-4o',
        maxTokens: 4000,
        temperature: 0.7
      });
    });
  });

  describe('handleOpenAIAPIError', () => {
    it('should handle various HTTP status codes', async () => {
      const testCases = [
        { status: 400, expectedMessage: 'Invalid request' },
        { status: 404, expectedMessage: 'Model not found' },
        { status: 500, expectedMessage: 'OpenAI server error' },
        { status: 502, expectedMessage: 'OpenAI server error' },
        { status: 503, expectedMessage: 'OpenAI server error' }
      ];

      for (const testCase of testCases) {
        const apiError = {
          status: testCase.status,
          message: 'API Error'
        };

        mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

        const messages: ChatMessage[] = [
          { role: 'user', content: 'Hello' }
        ];

        await expect(client.chatCompletion({ messages })).rejects.toThrow(testCase.expectedMessage);
      }
    });

    it('should handle errors without status', async () => {
      const apiError = {
        message: 'Some API error'
      };

      mockOpenAI.chat.completions.create.mockRejectedValue(apiError);

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ];

      await expect(client.chatCompletion({ messages })).rejects.toThrow('Unexpected error during chat completion');
    });
  });
});