/**
 * Tests for ProviderRegistry - Central provider management system
 * 
 * Tests provider registration, creation, retrieval, lifecycle management,
 * and health monitoring for both LLM providers and message channels.
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../src/utils/logger', () => ({
  agentLogger: {
    child: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    })
  }
}));

jest.mock('../src/core/llm/LLMProvider');
jest.mock('../src/core/channels/MessageChannel');

import { ProviderRegistry } from '../src/core/registry/ProviderRegistry';
import { LLMProvider, LLMProviderConfig, LLMRequest, LLMResponse, LLMCapabilities, LLMTokenUsage } from '../src/core/llm/LLMProvider';
import { MessageChannel, MessageChannelConfig, ChannelCapabilities, ChannelResponse, ChannelMessage, ChannelInfo, ChannelUser } from '../src/core/channels/MessageChannel';

// Mock LLM Provider that properly extends the abstract class
class MockLLMProvider extends LLMProvider {
  constructor(config: LLMProviderConfig, logger: any) {
    super(config, logger);
  }

  getProviderName(): string {
    return 'mock-llm';
  }

  getCapabilities(): LLMCapabilities {
    return {
      maxTokens: 4096,
      supportedModels: ['mock-model'],
      supportsStreaming: false,
      supportsVision: false,
      supportsTools: false,
      rateLimit: {
        requestsPerMinute: 60,
        tokensPerMinute: 60000
      }
    };
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    return {
      content: 'mock response',
      tokensUsed: {
        prompt: 10,
        completion: 5,
        total: 15
      },
      model: 'mock-model',
      finishReason: 'stop'
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  calculateCost(tokensUsed: LLMTokenUsage): number {
    return tokensUsed.totalTokens * 0.0001;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  destroy(): void {
    // Mock cleanup
  }
}

// Mock Message Channel that properly extends the abstract class
class MockMessageChannel extends MessageChannel {
  constructor(config: MessageChannelConfig, logger: any) {
    super(config, logger);
  }

  getChannelName(): string {
    return 'mock-channel';
  }

  getCapabilities(): ChannelCapabilities {
    return {
      supportsThreads: true,
      supportsFiles: true,
      supportsBlocks: true,
      supportsReactions: true,
      supportsTypingIndicator: true,
      maxMessageLength: 4000,
      supportedFileTypes: ['text', 'image']
    };
  }

  async start(): Promise<void> {
    this.isConnected = true;
  }

  async stop(): Promise<void> {
    this.isConnected = false;
  }

  async sendMessage(response: ChannelResponse): Promise<void> {
    // Mock send message
  }

  async updateMessage(channel: string, messageId: string, content: string): Promise<void> {
    // Mock update message
  }

  async sendTypingIndicator(channel: string): Promise<void> {
    // Mock typing indicator
  }

  async getChannelInfo(channelId: string): Promise<ChannelInfo> {
    return {
      id: channelId,
      name: 'mock-channel',
      type: 'public'
    };
  }

  async getUserInfo(userId: string): Promise<ChannelUser> {
    return {
      id: userId,
      name: 'mock-user'
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('ProviderRegistry', () => {
  beforeEach(async () => {
    // Reset the registry before each test
    await ProviderRegistry.cleanup();
  });

  afterEach(async () => {
    // Clean up after each test
    await ProviderRegistry.cleanup();
  });

  describe('LLM Provider Registration', () => {
    it('should register LLM provider factory', () => {
      const factory = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      
      ProviderRegistry.registerLLMProvider('mock-llm', factory, {
        description: 'Mock LLM Provider',
        version: '1.0.0'
      });

      expect(ProviderRegistry.hasLLMProvider('mock-llm')).toBe(true);
    });

    it('should register message channel factory', () => {
      const factory = (config: MessageChannelConfig, logger: any) => new MockMessageChannel(config, logger);
      
      ProviderRegistry.registerMessageChannel('mock-channel', factory, {
        description: 'Mock Channel Provider',
        version: '1.0.0'
      });

      expect(ProviderRegistry.hasMessageChannel('mock-channel')).toBe(true);
    });

    it('should handle multiple provider registrations', () => {
      const factory1 = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      const factory2 = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);

      ProviderRegistry.registerLLMProvider('mock-llm-1', factory1, {
        description: 'Mock LLM Provider 1',
        version: '1.0.0'
      });
      ProviderRegistry.registerLLMProvider('mock-llm-2', factory2, {
        description: 'Mock LLM Provider 2',
        version: '1.0.0'
      });

      expect(ProviderRegistry.hasLLMProvider('mock-llm-1')).toBe(true);
      expect(ProviderRegistry.hasLLMProvider('mock-llm-2')).toBe(true);
    });
  });

  describe('Provider Creation', () => {
    it('should create LLM provider from factory', async () => {
      const factory = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      
      ProviderRegistry.registerLLMProvider('test-llm', factory, {
        description: 'Test LLM Provider',
        version: '1.0.0'
      });

      const provider = await ProviderRegistry.createLLMProvider('test-llm', {
        apiKey: 'test-key',
        model: 'test-model',
        temperature: 0.7,
        maxTokens: 1000
      });

      expect(provider).toBeInstanceOf(MockLLMProvider);
    });

    it('should create message channel from factory', async () => {
      const factory = (config: MessageChannelConfig, logger: any) => new MockMessageChannel(config, logger);
      
      ProviderRegistry.registerMessageChannel('test-channel', factory, {
        description: 'Test Channel Provider',
        version: '1.0.0'
      });

      const channel = await ProviderRegistry.createMessageChannel('test-channel', {
        apiKey: 'test-key'
      });

      expect(channel).toBeInstanceOf(MockMessageChannel);
    });
  });

  describe('Provider Retrieval', () => {
    it('should retrieve active LLM provider', async () => {
      const factory = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      
      ProviderRegistry.registerLLMProvider('test-llm', factory, {
        description: 'Test LLM Provider',
        version: '1.0.0'
      });

      await ProviderRegistry.createLLMProvider('test-llm', { apiKey: 'test-key', model: 'test-model', temperature: 0.7, maxTokens: 1000 });

      const provider = ProviderRegistry.getLLMProvider('test-llm');
      expect(provider).toBeInstanceOf(MockLLMProvider);
    });

    it('should return undefined for non-existent provider', () => {
      const provider = ProviderRegistry.getLLMProvider('non-existent');
      expect(provider).toBeUndefined();
    });

    it('should list available providers', () => {
      const factory1 = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      const factory2 = (config: MessageChannelConfig, logger: any) => new MockMessageChannel(config, logger);

      ProviderRegistry.registerLLMProvider('llm1', factory1, {
        description: 'LLM Provider 1',
        version: '1.0.0'
      });
      ProviderRegistry.registerMessageChannel('channel1', factory2, {
        description: 'Channel Provider 1',
        version: '1.0.0'
      });

      const llmProviders = ProviderRegistry.getAvailableLLMProviders();
      const channelProviders = ProviderRegistry.getAvailableMessageChannels();

      expect(llmProviders).toContain('llm1');
      expect(channelProviders).toContain('channel1');
    });
  });

  describe('Provider Info', () => {
    it('should store and retrieve provider information', () => {
      const factory = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      const info = {
        description: 'OpenAI GPT Provider',
        version: '1.0.0',
        author: 'OpenAI'
      };

      ProviderRegistry.registerLLMProvider('openai', factory, info);

      const retrievedInfo = ProviderRegistry.getProviderInfo('openai');
      expect(retrievedInfo).toMatchObject(info);
    });
  });

  describe('Health Monitoring', () => {
    it('should perform health checks on all providers', async () => {
      const llmFactory = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      const channelFactory = (config: MessageChannelConfig, logger: any) => new MockMessageChannel(config, logger);

      ProviderRegistry.registerLLMProvider('healthy-llm', llmFactory, {
        description: 'Healthy LLM',
        version: '1.0.0'
      });
      ProviderRegistry.registerMessageChannel('healthy-channel', channelFactory, {
        description: 'Healthy Channel',
        version: '1.0.0'
      });

      await ProviderRegistry.createLLMProvider('healthy-llm', { apiKey: 'test-key', model: 'test-model', temperature: 0.7, maxTokens: 1000 });
      await ProviderRegistry.createMessageChannel('healthy-channel', {
        apiKey: 'test-key'
      });

      const healthStatus = await ProviderRegistry.healthCheckAll();
      expect(healthStatus['healthy-llm']).toBe(true);
      expect(healthStatus['healthy-channel']).toBe(true);
    });
  });

  describe('Provider Status', () => {
    it('should return comprehensive registry status', async () => {
      const llmFactory = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      const channelFactory = (config: MessageChannelConfig, logger: any) => new MockMessageChannel(config, logger);

      ProviderRegistry.registerLLMProvider('status-llm', llmFactory, {
        description: 'Status LLM',
        version: '1.0.0'
      });
      ProviderRegistry.registerMessageChannel('status-channel', channelFactory, {
        description: 'Status Channel',
        version: '1.0.0'
      });

      await ProviderRegistry.createLLMProvider('status-llm', { apiKey: 'test-key', model: 'test-model', temperature: 0.7, maxTokens: 1000 });

      const status = ProviderRegistry.getStatus();
      expect(status.llmProviders.registered).toContain('status-llm');
      expect(status.llmProviders.active).toContain('status-llm');
      expect(status.messageChannels.registered).toContain('status-channel');
      expect(status.totalProviders).toBeGreaterThan(0);
    });
  });

  describe('Provider Cleanup', () => {
    it('should deactivate LLM providers', async () => {
      const factory = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      
      ProviderRegistry.registerLLMProvider('cleanup-test', factory, {
        description: 'Cleanup Test',
        version: '1.0.0'
      });

      await ProviderRegistry.createLLMProvider('cleanup-test', { apiKey: 'test-key', model: 'test-model', temperature: 0.7, maxTokens: 1000 });

      expect(ProviderRegistry.getLLMProvider('cleanup-test')).toBeDefined();

      await ProviderRegistry.deactivateLLMProvider('cleanup-test');
      expect(ProviderRegistry.getLLMProvider('cleanup-test')).toBeUndefined();
    });

    it('should cleanup all providers', async () => {
      const llmFactory = (config: LLMProviderConfig, logger: any) => new MockLLMProvider(config, logger);
      const channelFactory = (config: MessageChannelConfig, logger: any) => new MockMessageChannel(config, logger);

      ProviderRegistry.registerLLMProvider('cleanup-llm', llmFactory, {
        description: 'Cleanup LLM',
        version: '1.0.0'
      });
      ProviderRegistry.registerMessageChannel('cleanup-channel', channelFactory, {
        description: 'Cleanup Channel',
        version: '1.0.0'
      });

      await ProviderRegistry.createLLMProvider('cleanup-llm', { apiKey: 'test-key', model: 'test-model', temperature: 0.7, maxTokens: 1000 });
      await ProviderRegistry.createMessageChannel('cleanup-channel', {
        apiKey: 'test-key'
      });

      const statusBefore = ProviderRegistry.getStatus();
      expect(statusBefore.totalProviders).toBeGreaterThan(0);

      await ProviderRegistry.cleanup();

      const statusAfter = ProviderRegistry.getStatus();
      expect(statusAfter.llmProviders.active).toHaveLength(0);
      expect(statusAfter.messageChannels.active).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent provider creation', async () => {
      await expect(
        ProviderRegistry.createLLMProvider('non-existent', { apiKey: 'test-key', model: 'test-model', temperature: 0.7, maxTokens: 1000 })
      ).rejects.toThrow();
    });

    it('should handle provider deactivation errors gracefully', async () => {
      // This should not throw even if provider doesn't exist
      await expect(ProviderRegistry.deactivateLLMProvider('non-existent')).resolves.not.toThrow();
    });
  });
});

