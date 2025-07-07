/**
 * Tests for BuiltinProviders - Provider Registration and Initialization
 * 
 * Tests registration of built-in providers, initialization logic,
 * configuration validation, and provider creation.
 */

import { jest } from '@jest/globals';
import {
  registerBuiltinProviders,
  initializeProviders
} from '../src/core/providers/BuiltinProviders';
import { ProviderRegistry } from '../src/core/registry/ProviderRegistry';

// Mock ProviderRegistry - define mock object first to avoid initialization issues
// Mock provider factories
const mockOpenAIProvider = {
  getProviderName: () => 'openai',
  getCapabilities: jest.fn(() => ({
    supportedModels: ['gpt-4', 'gpt-3.5-turbo'],
    maxTokens: 128000,
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true
  })),
  generateResponse: jest.fn(),
  estimateTokens: jest.fn(),
  calculateCost: jest.fn(),
  healthCheck: jest.fn(),
  destroy: jest.fn(),
  getConfig: jest.fn(),
  updateConfig: jest.fn()
} as any;

const mockSlackChannel = {
  getChannelName: () => 'slack',
  messageHandlers: [],
  isConnected: false,
  getCapabilities: jest.fn(() => ({
    supportsThreads: true,
    supportsFiles: true,
    supportsBlocks: true,
    supportsReactions: true,
    supportsTypingIndicator: true,
    maxMessageLength: 4000,
    supportedFileTypes: ['pdf', 'txt', 'png', 'jpg']
  })),
  start: jest.fn(),
  stop: jest.fn(),
  sendMessage: jest.fn(),
  updateMessage: jest.fn(),
  sendTypingIndicator: jest.fn(),
  getChannelInfo: jest.fn(),
  getUserInfo: jest.fn(),
  addMessageHandler: jest.fn(),
  removeMessageHandler: jest.fn(),
  getConnection: jest.fn(),
  healthCheck: jest.fn(),
  destroy: jest.fn(),
  getConfig: jest.fn(),
  updateConfig: jest.fn(),
  onMessage: jest.fn(),
  offMessage: jest.fn(),
  triggerMessageHandlers: jest.fn(),
  isReady: jest.fn(() => true)
} as any;

jest.mock('../src/core/registry/ProviderRegistry', () => ({
  ProviderRegistry: {
    registerLLMProvider: jest.fn(),
    registerMessageChannel: jest.fn(),
    createLLMProvider: jest.fn() as jest.MockedFunction<any>,
    createMessageChannel: jest.fn() as jest.MockedFunction<any>
  }
}));

const mockProviderRegistry = ProviderRegistry as jest.Mocked<typeof ProviderRegistry>;

jest.mock('../src/providers/llm/OpenAIProvider', () => ({
  createOpenAIProvider: jest.fn(() => mockOpenAIProvider)
}));

jest.mock('../src/providers/channels/SlackChannel', () => ({
  createSlackChannel: jest.fn(() => mockSlackChannel)
}));

// Mock ConfigManager
const mockConfigManager = {
  getConfig: jest.fn(),
  validateConfig: jest.fn()
};

jest.mock('../src/core/config/ConfigManager', () => ({
  ConfigManager: mockConfigManager
}));

describe('BuiltinProviders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerBuiltinProviders', () => {
    it('should register OpenAI LLM provider', () => {
      const { createOpenAIProvider } = require('../src/providers/llm/OpenAIProvider');
      
      registerBuiltinProviders();

      expect(mockProviderRegistry.registerLLMProvider).toHaveBeenCalledWith(
        'openai',
        createOpenAIProvider,
        {
          description: 'OpenAI GPT models integration',
          version: '1.0.0',
          author: 'Agent System',
          capabilities: {
            streaming: true,
            vision: true,
            tools: true,
            maxTokens: 128000
          }
        }
      );
    });

    it('should register Slack message channel', () => {
      const { createSlackChannel } = require('../src/providers/channels/SlackChannel');
      
      registerBuiltinProviders();

      expect(mockProviderRegistry.registerMessageChannel).toHaveBeenCalledWith(
        'slack',
        createSlackChannel,
        {
          description: 'Slack integration for messaging',
          version: '1.0.0',
          author: 'Agent System',
          capabilities: {
            threads: true,
            files: true,
            blocks: true,
            reactions: true
          }
        }
      );
    });

    it('should register both providers when called', () => {
      registerBuiltinProviders();

      expect(mockProviderRegistry.registerLLMProvider).toHaveBeenCalledTimes(1);
      expect(mockProviderRegistry.registerMessageChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('initializeProviders', () => {
    const mockValidConfig = {
      providers: {
        llm: {
          openai: {
            enabled: true,
            apiKey: 'test-key',
            model: 'gpt-4'
          }
        },
        channels: {
          slack: {
            enabled: true,
            botToken: 'xoxb-test',
            signingSecret: 'secret',
            appToken: 'xapp-test'
          }
        }
      }
    };

    beforeEach(() => {
      mockConfigManager.getConfig.mockReturnValue(mockValidConfig);
      mockConfigManager.validateConfig.mockReturnValue({
        isValid: true,
        errors: []
      });
      mockProviderRegistry.createLLMProvider.mockResolvedValue(mockOpenAIProvider);
      mockProviderRegistry.createMessageChannel.mockResolvedValue(mockSlackChannel);
    });

    it('should register builtin providers before initialization', async () => {
      await initializeProviders();

      expect(mockProviderRegistry.registerLLMProvider).toHaveBeenCalledWith('openai', expect.any(Function), expect.any(Object));
      expect(mockProviderRegistry.registerMessageChannel).toHaveBeenCalledWith('slack', expect.any(Function), expect.any(Object));
    });

    it('should validate configuration before proceeding', async () => {
      await initializeProviders();

      expect(mockConfigManager.getConfig).toHaveBeenCalledTimes(1);
      expect(mockConfigManager.validateConfig).toHaveBeenCalledTimes(1);
    });

    it('should throw error for invalid configuration', async () => {
      mockConfigManager.validateConfig.mockReturnValue({
        isValid: false,
        errors: ['Missing API key', 'Invalid model']
      });

      await expect(initializeProviders()).rejects.toThrow(
        'Configuration validation failed: Missing API key, Invalid model'
      );
    });

    it('should initialize enabled LLM providers', async () => {
      const result = await initializeProviders();

      expect(mockProviderRegistry.createLLMProvider).toHaveBeenCalledWith(
        'openai',
        mockValidConfig.providers.llm.openai
      );
      expect(result.llmProvider).toBe(mockOpenAIProvider);
    });

    it('should initialize enabled message channels', async () => {
      const result = await initializeProviders();

      expect(mockProviderRegistry.createMessageChannel).toHaveBeenCalledWith(
        'slack',
        mockValidConfig.providers.channels.slack
      );
      expect(result.messageChannel).toBe(mockSlackChannel);
    });

    it('should return both providers when all are enabled', async () => {
      const result = await initializeProviders();

      expect(result).toEqual({
        llmProvider: mockOpenAIProvider,
        messageChannel: mockSlackChannel
      });
    });

    it('should skip disabled LLM providers', async () => {
      const configWithDisabledLLM = {
        ...mockValidConfig,
        providers: {
          ...mockValidConfig.providers,
          llm: {
            openai: {
              ...mockValidConfig.providers.llm.openai,
              enabled: false
            }
          }
        }
      };
      mockConfigManager.getConfig.mockReturnValue(configWithDisabledLLM);

      const result = await initializeProviders();

      expect(mockProviderRegistry.createLLMProvider).not.toHaveBeenCalled();
      expect(result.llmProvider).toBeUndefined();
      expect(result.messageChannel).toBe(mockSlackChannel);
    });

    it('should skip disabled message channels', async () => {
      const configWithDisabledChannel = {
        ...mockValidConfig,
        providers: {
          ...mockValidConfig.providers,
          channels: {
            slack: {
              ...mockValidConfig.providers.channels.slack,
              enabled: false
            }
          }
        }
      };
      mockConfigManager.getConfig.mockReturnValue(configWithDisabledChannel);

      const result = await initializeProviders();

      expect(mockProviderRegistry.createMessageChannel).not.toHaveBeenCalled();
      expect(result.messageChannel).toBeUndefined();
      expect(result.llmProvider).toBe(mockOpenAIProvider);
    });

    it('should handle missing enabled property as enabled', async () => {
      const configWithoutEnabledFlag = {
        providers: {
          llm: {
            openai: {
              apiKey: 'test-key',
              model: 'gpt-4'
              // No enabled property
            }
          },
          channels: {
            slack: {
              botToken: 'xoxb-test',
              signingSecret: 'secret',
              appToken: 'xapp-test'
              // No enabled property
            }
          }
        }
      };
      mockConfigManager.getConfig.mockReturnValue(configWithoutEnabledFlag);

      const result = await initializeProviders();

      expect(mockProviderRegistry.createLLMProvider).toHaveBeenCalledWith(
        'openai',
        configWithoutEnabledFlag.providers.llm.openai
      );
      expect(mockProviderRegistry.createMessageChannel).toHaveBeenCalledWith(
        'slack',
        configWithoutEnabledFlag.providers.channels.slack
      );
      expect(result.llmProvider).toBe(mockOpenAIProvider);
      expect(result.messageChannel).toBe(mockSlackChannel);
    });

    it('should use first enabled provider when multiple are available', async () => {
      const configWithMultipleProviders = {
        providers: {
          llm: {
            openai: {
              enabled: true,
              apiKey: 'openai-key',
              model: 'gpt-4'
            },
            anthropic: {
              enabled: true,
              apiKey: 'anthropic-key',
              model: 'claude-3'
            }
          },
          channels: {
            slack: {
              enabled: true,
              botToken: 'slack-token'
            },
            discord: {
              enabled: true,
              botToken: 'discord-token'
            }
          }
        }
      };
      mockConfigManager.getConfig.mockReturnValue(configWithMultipleProviders);

      await initializeProviders();

      // Should use the first enabled provider (Object.keys order)
      expect(mockProviderRegistry.createLLMProvider).toHaveBeenCalledWith(
        'openai',
        configWithMultipleProviders.providers.llm.openai
      );
      expect(mockProviderRegistry.createMessageChannel).toHaveBeenCalledWith(
        'slack',
        configWithMultipleProviders.providers.channels.slack
      );
    });

    it('should handle empty provider configurations', async () => {
      const emptyConfig = {
        providers: {
          llm: {},
          channels: {}
        }
      };
      mockConfigManager.getConfig.mockReturnValue(emptyConfig);

      const result = await initializeProviders();

      expect(mockProviderRegistry.createLLMProvider).not.toHaveBeenCalled();
      expect(mockProviderRegistry.createMessageChannel).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should handle provider creation errors', async () => {
      const error = new Error('Failed to create provider');
      mockProviderRegistry.createLLMProvider.mockRejectedValue(error);

      await expect(initializeProviders()).rejects.toThrow('Failed to create provider');
    });

    it('should handle missing provider config gracefully', async () => {
      const configWithMissingProviderConfig = {
        providers: {
          llm: {
            openai: null // Null config
          },
          channels: {
            slack: undefined // Undefined config
          }
        }
      };
      mockConfigManager.getConfig.mockReturnValue(configWithMissingProviderConfig);

      const result = await initializeProviders();

      expect(mockProviderRegistry.createLLMProvider).not.toHaveBeenCalled();
      expect(mockProviderRegistry.createMessageChannel).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });

    it('should filter providers correctly with complex enabled logic', async () => {
      const complexConfig = {
        providers: {
          llm: {
            provider1: { enabled: true, apiKey: 'key1' },
            provider2: { enabled: false, apiKey: 'key2' },
            provider3: { apiKey: 'key3' }, // No enabled flag
            provider4: { enabled: null, apiKey: 'key4' }, // null enabled
            provider5: { enabled: undefined, apiKey: 'key5' } // undefined enabled
          },
          channels: {
            channel1: { enabled: true, token: 'token1' },
            channel2: { enabled: false, token: 'token2' },
            channel3: { token: 'token3' }, // No enabled flag
            channel4: { enabled: 0, token: 'token4' }, // Falsy enabled
            channel5: { enabled: '', token: 'token5' } // Empty string enabled
          }
        }
      };
      mockConfigManager.getConfig.mockReturnValue(complexConfig);

      await initializeProviders();

      // Should only use providers where enabled !== false
      expect(mockProviderRegistry.createLLMProvider).toHaveBeenCalledWith(
        'provider1',
        complexConfig.providers.llm.provider1
      );
      expect(mockProviderRegistry.createMessageChannel).toHaveBeenCalledWith(
        'channel1',
        complexConfig.providers.channels.channel1
      );
    });
  });

  describe('error handling', () => {
    it('should handle configuration loading errors', async () => {
      const configError = new Error('Failed to load config');
      mockConfigManager.getConfig.mockImplementation(() => {
        throw configError;
      });

      await expect(initializeProviders()).rejects.toThrow('Failed to load config');
    });

    it('should handle validation errors gracefully', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        providers: { llm: {}, channels: {} }
      });
      mockConfigManager.validateConfig.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      await expect(initializeProviders()).rejects.toThrow('Validation failed');
    });

    it('should handle provider registry errors', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        providers: {
          llm: { openai: { enabled: true, apiKey: 'key' } },
          channels: {}
        }
      });
      mockConfigManager.validateConfig.mockReturnValue({ isValid: true, errors: [] });

      const registryError = new Error('Registry error');
      mockProviderRegistry.createLLMProvider.mockRejectedValue(registryError);

      await expect(initializeProviders()).rejects.toThrow('Registry error');
    });
  });

  describe('integration', () => {
    beforeEach(() => {
      // Reset mock to resolved state for integration tests
      mockProviderRegistry.createLLMProvider.mockResolvedValue(mockOpenAIProvider);
      mockProviderRegistry.createMessageChannel.mockResolvedValue(mockSlackChannel);
    });

    it('should work with real provider configuration format', async () => {
      const realWorldConfig = {
        providers: {
          llm: {
            openai: {
              enabled: true,
              apiKey: 'sk-test123',
              model: 'gpt-4',
              maxTokens: 4096,
              temperature: 0.7
            }
          },
          channels: {
            slack: {
              enabled: true,
              botToken: 'xoxb-slack-token',
              signingSecret: 'slack-signing-secret',
              appToken: 'xapp-slack-app-token'
            }
          }
        }
      };

      mockConfigManager.getConfig.mockReturnValue(realWorldConfig);
      mockConfigManager.validateConfig.mockReturnValue({ isValid: true, errors: [] });

      const result = await initializeProviders();

      expect(result).toEqual({
        llmProvider: mockOpenAIProvider,
        messageChannel: mockSlackChannel
      });

      expect(mockProviderRegistry.createLLMProvider).toHaveBeenCalledWith(
        'openai',
        realWorldConfig.providers.llm.openai
      );
      expect(mockProviderRegistry.createMessageChannel).toHaveBeenCalledWith(
        'slack',
        realWorldConfig.providers.channels.slack
      );
    });
  });
});
