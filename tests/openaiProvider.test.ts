/**
 * Tests for OpenAIProvider - OpenAI LLM Provider Implementation
 * 
 * Tests OpenAI API integration, error handling, token management,
 * and cost calculations.
 */

import { jest } from '@jest/globals';
import { OpenAIProvider } from '../src/providers/llm/OpenAIProvider';
import { LLMProviderConfig, LLMRequest } from '../src/core/llm/LLMProvider';
import { OpenAIError } from '../src/utils/errors';
import { OPENAI_PRICING } from '../src/config/constants';

// Mock OpenAI client
const mockCreate = jest.fn() as jest.MockedFunction<any>;
const mockOpenAI = {
  chat: {
    completions: {
      create: mockCreate
    }
  }
};

// Mock OpenAI module
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger)
};

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let config: LLMProviderConfig;

  beforeEach(() => {
    config = {
      apiKey: 'test-api-key',
      model: 'gpt-4',
      maxTokens: 4096,
      temperature: 0.7
    };

    jest.clearAllMocks();
    provider = new OpenAIProvider(config, mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.getProviderName()).toBe('openai');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'OpenAI provider initialized',
        expect.objectContaining({
          model: 'gpt-4',
          maxTokens: 4096,
          temperature: 0.7
        })
      );
    });

    it('should throw error when API key is missing', () => {
      const invalidConfig = { ...config, apiKey: '' };
      
      expect(() => new OpenAIProvider(invalidConfig, mockLogger)).toThrow(OpenAIError);
      expect(() => new OpenAIProvider(invalidConfig, mockLogger)).toThrow('OpenAI API key is required');
    });

    it('should throw error when API key is undefined', () => {
      const invalidConfig = { ...config };
      delete (invalidConfig as any).apiKey;
      
      expect(() => new OpenAIProvider(invalidConfig, mockLogger)).toThrow(OpenAIError);
    });
  });

  describe('getProviderName', () => {
    it('should return "openai"', () => {
      expect(provider.getProviderName()).toBe('openai');
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities for GPT-4', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities).toEqual({
        maxTokens: 8192,
        supportedModels: [
          'gpt-4o',
          'gpt-4',
          'gpt-4-turbo',
          'gpt-3.5-turbo'
        ],
        supportsStreaming: true,
        supportsVision: true,
        supportsTools: true,
        rateLimit: {
          requestsPerMinute: 50,
          tokensPerMinute: 90000
        }
      });
    });

    it('should indicate vision support for GPT-4 models', () => {
      const gpt4Provider = new OpenAIProvider({ ...config, model: 'gpt-4-turbo' }, mockLogger);
      expect(gpt4Provider.getCapabilities().supportsVision).toBe(true);
    });

    it('should indicate no vision support for GPT-3.5', () => {
      const gpt35Provider = new OpenAIProvider({ ...config, model: 'gpt-3.5-turbo' }, mockLogger);
      expect(gpt35Provider.getCapabilities().supportsVision).toBe(false);
    });

    it('should return correct max tokens for different models', () => {
      const gpt4oProvider = new OpenAIProvider({ ...config, model: 'gpt-4o' }, mockLogger);
      expect(gpt4oProvider.getCapabilities().maxTokens).toBe(128000);

      const gpt35Provider = new OpenAIProvider({ ...config, model: 'gpt-3.5-turbo' }, mockLogger);
      expect(gpt35Provider.getCapabilities().maxTokens).toBe(16384);
    });
  });

  describe('generateResponse', () => {
    const mockRequest: LLMRequest = {
      messages: [
        { role: 'user', content: 'Hello, how are you?' }
      ]
    };

    const mockOpenAIResponse = {
      choices: [{
        message: {
          content: 'I am doing well, thank you!'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 8,
        total_tokens: 18
      },
      model: 'gpt-4'
    };

    beforeEach(() => {
      mockCreate.mockResolvedValue(mockOpenAIResponse);
    });

    it('should generate response successfully', async () => {
      const response = await provider.generateResponse(mockRequest);

      expect(response).toEqual({
        content: 'I am doing well, thank you!',
        tokensUsed: {
          prompt: 10,
          completion: 8,
          total: 18
        },
        model: 'gpt-4',
        finishReason: 'stop',
        metadata: expect.objectContaining({
          duration: expect.any(Number),
          usage: mockOpenAIResponse.usage
        })
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        temperature: 0.7,
        max_tokens: 4096
      });
    });

    it('should use request-specific parameters', async () => {
      const customRequest: LLMRequest = {
        ...mockRequest,
        model: 'gpt-3.5-turbo',
        temperature: 0.5,
        maxTokens: 2048
      };

      await provider.generateResponse(customRequest);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello, how are you?' }],
        temperature: 0.5,
        max_tokens: 2048
      });
    });

    it('should log request and response details', async () => {
      await provider.generateResponse(mockRequest);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Sending OpenAI request',
        expect.objectContaining({
          messageCount: 1,
          model: 'gpt-4',
          temperature: 0.7,
          maxTokens: 4096
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'OpenAI request successful',
        expect.objectContaining({
          tokensUsed: { prompt: 10, completion: 8, total: 18 },
          duration: expect.any(Number),
          finishReason: 'stop',
          model: 'gpt-4'
        })
      );
    });

    it('should throw error when no choices returned', async () => {
      mockCreate.mockResolvedValue({ choices: [] });

      await expect(provider.generateResponse(mockRequest)).rejects.toThrow(OpenAIError);
      await expect(provider.generateResponse(mockRequest)).rejects.toThrow('No choices returned from OpenAI');
    });

    it('should throw error when choice is invalid', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: null }]
      });

      await expect(provider.generateResponse(mockRequest)).rejects.toThrow(OpenAIError);
      await expect(provider.generateResponse(mockRequest)).rejects.toThrow('Invalid choice from OpenAI response');
    });

    it('should handle missing usage data gracefully', async () => {
      const responseWithoutUsage = {
        ...mockOpenAIResponse,
        usage: undefined
      };
      mockCreate.mockResolvedValue(responseWithoutUsage);

      const response = await provider.generateResponse(mockRequest);

      expect(response.tokensUsed).toEqual({
        prompt: 0,
        completion: 0,
        total: 0
      });
    });

    it('should handle API errors correctly', async () => {
      const apiError = {
        status: 401,
        message: 'Invalid API key'
      };
      mockCreate.mockRejectedValue(apiError);

      await expect(provider.generateResponse(mockRequest)).rejects.toThrow(OpenAIError);
      await expect(provider.generateResponse(mockRequest)).rejects.toThrow('Invalid API key');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = {
        status: 429,
        message: 'Rate limit exceeded'
      };
      mockCreate.mockRejectedValue(rateLimitError);

      await expect(provider.generateResponse(mockRequest)).rejects.toThrow(OpenAIError);
      await expect(provider.generateResponse(mockRequest)).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle server errors', async () => {
      const serverError = {
        status: 500,
        message: 'Internal server error'
      };
      mockCreate.mockRejectedValue(serverError);

      await expect(provider.generateResponse(mockRequest)).rejects.toThrow(OpenAIError);
      await expect(provider.generateResponse(mockRequest)).rejects.toThrow('OpenAI server error');
    });

    it('should handle unexpected errors', async () => {
      const unexpectedError = new Error('Network error');
      mockCreate.mockRejectedValue(unexpectedError);

      await expect(provider.generateResponse(mockRequest)).rejects.toThrow(OpenAIError);
      await expect(provider.generateResponse(mockRequest)).rejects.toThrow('Unexpected error during OpenAI request');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate tokens correctly', () => {
      const text = 'This is a test message';
      const estimated = provider.estimateTokens(text);
      
      // Should be roughly text.length / 4, rounded up
      expect(estimated).toBe(Math.ceil(text.length / 4));
    });

    it('should handle empty string', () => {
      expect(provider.estimateTokens('')).toBe(0);
    });

    it('should handle longer text', () => {
      const longText = 'A'.repeat(1000);
      const estimated = provider.estimateTokens(longText);
      
      expect(estimated).toBe(250); // 1000 / 4
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for GPT-4', () => {
      const tokensUsed = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };

      const cost = provider.calculateCost(tokensUsed);
      
      // GPT-4: use constants for input/output pricing
      const expectedCost = (1000 / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * OPENAI_PRICING.GPT_4.PROMPT_RATE + 
                           (500 / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * OPENAI_PRICING.GPT_4.COMPLETION_RATE;
      expect(cost).toBe(expectedCost);
    });

    it('should calculate cost for GPT-3.5-turbo', () => {
      const gpt35Provider = new OpenAIProvider({ ...config, model: 'gpt-3.5-turbo' }, mockLogger);
      const tokensUsed = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };

      const cost = gpt35Provider.calculateCost(tokensUsed);
      
      // GPT-3.5-turbo: use constants for input/output pricing
      const expectedCost = (1000 / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * OPENAI_PRICING.GPT_3_5_TURBO.PROMPT_RATE + 
                           (500 / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * OPENAI_PRICING.GPT_3_5_TURBO.COMPLETION_RATE;
      expect(cost).toBe(expectedCost);
    });

    it('should use default pricing for unknown models', () => {
      const unknownModelProvider = new OpenAIProvider({ ...config, model: 'unknown-model' }, mockLogger);
      const tokensUsed = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500
      };

      const cost = unknownModelProvider.calculateCost(tokensUsed);
      
      // Should default to GPT-4 pricing
      const expectedCost = (1000 / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * OPENAI_PRICING.GPT_4.PROMPT_RATE + 
                           (500 / OPENAI_PRICING.TOKEN_DIVISION_FACTOR) * OPENAI_PRICING.GPT_4.COMPLETION_RATE;
      expect(cost).toBe(expectedCost);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }]
      });

      const isHealthy = await provider.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 1,
        temperature: 0
      });
    });

    it('should return false when API request fails', async () => {
      mockCreate.mockRejectedValue(new Error('API error'));

      const isHealthy = await provider.healthCheck();
      
      expect(isHealthy).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'OpenAI health check failed',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });

    it('should return false when no choices returned', async () => {
      mockCreate.mockResolvedValue({ choices: [] });

      const isHealthy = await provider.healthCheck();
      
      expect(isHealthy).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should log destruction', () => {
      provider.destroy();
      
      expect(mockLogger.info).toHaveBeenCalledWith('OpenAI provider destroyed');
    });
  });

  describe('error handling', () => {
    const testCases = [
      { status: 400, expectedMessage: 'Invalid request', expectedCode: 'OPENAI_INVALID_REQUEST' },
      { status: 401, expectedMessage: 'Invalid API key', expectedCode: 'OPENAI_INVALID_API_KEY' },
      { status: 404, expectedMessage: 'Model not found', expectedCode: 'OPENAI_MODEL_NOT_FOUND' },
      { status: 429, expectedMessage: 'Rate limit exceeded', expectedCode: 'OPENAI_RATE_LIMIT_EXCEEDED' },
      { status: 500, expectedMessage: 'OpenAI server error', expectedCode: 'OPENAI_SERVER_ERROR' },
      { status: 502, expectedMessage: 'OpenAI server error', expectedCode: 'OPENAI_SERVER_ERROR' },
      { status: 503, expectedMessage: 'OpenAI server error', expectedCode: 'OPENAI_SERVER_ERROR' }
    ];

    testCases.forEach(({ status, expectedMessage, expectedCode }) => {
      it(`should handle ${status} errors correctly`, async () => {
        const apiError = { status, message: `HTTP ${status} error` };
        mockCreate.mockRejectedValue(apiError);

        try {
          await provider.generateResponse({
            messages: [{ role: 'user', content: 'test' }]
          });
          fail('Should have thrown an error');
        } catch (error) {
          expect(error).toBeInstanceOf(OpenAIError);
          expect((error as OpenAIError).message).toContain(expectedMessage);
          expect((error as OpenAIError).code).toBe(expectedCode);
        }
      });
    });
  });

  describe('createOpenAIProvider factory', () => {
    it('should create provider instance', () => {
      const { createOpenAIProvider } = require('../src/providers/llm/OpenAIProvider');
      const factoryProvider = createOpenAIProvider(config, mockLogger);
      
      expect(factoryProvider).toBeInstanceOf(OpenAIProvider);
      expect(factoryProvider.getProviderName()).toBe('openai');
    });
  });
});
